"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Mic, MicOff, Send, Phone, PhoneOff, Volume2, VolumeX,
  Stethoscope, AlertCircle, Loader2, ChevronDown
} from "lucide-react";
import { patientApi } from "@/lib/api";
import { createAudioRecorder, transcribeAudio, speakText } from "@/lib/cartesia";
import { useAuthStore } from "@/lib/store";
import { cn, timeAgo } from "@/lib/utils";
import PatientLayout from "@/components/PatientLayout";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
};

export default function ClinicPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<ReturnType<typeof createAudioRecorder> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) router.push("/login");
  }, [user, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = (role: Message["role"], content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role, content, timestamp: new Date().toISOString() },
    ]);
  };

  const startSession = async () => {
    setStarting(true);
    try {
      const res = await patientApi.startClinicSession({ audio_enabled: true });
      const sid = res.data.session_id;
      setSessionId(sid);
      addMessage("system", "Clinic session started. I'm your CrossCures companion. Ask me about your health history, or tell me what you'd like to discuss with your doctor today.");
    } catch (e: any) {
      addMessage("system", `Failed to start session: ${e.response?.data?.detail || e.message}`);
    } finally {
      setStarting(false);
    }
  };

  const sendMessage = async (text?: string) => {
    const content = (text || input).trim();
    if (!content || !sessionId || loading) return;
    setInput("");
    addMessage("user", content);
    setLoading(true);
    try {
      const res = await patientApi.sendClinicTurn(sessionId, content);
      const agentContent = res.data.content;
      addMessage("assistant", agentContent);
      if (ttsEnabled) {
        setTtsPlaying(true);
        await speakText(agentContent).finally(() => setTtsPlaying(false));
      }
    } catch (e: any) {
      addMessage("assistant", "I'm having trouble processing your request. Please try again.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleVoice = async () => {
    if (!recorderRef.current) recorderRef.current = createAudioRecorder();
    if (recording) {
      setRecording(false);
      setTranscribing(true);
      try {
        const blob = await recorderRef.current.stop();
        const result = await transcribeAudio(blob);
        if (result.text) {
          sendMessage(result.text);
        }
      } catch (e) {
        console.error("Voice input failed:", e);
      } finally {
        setTranscribing(false);
        recorderRef.current = null;
      }
    } else {
      try {
        await recorderRef.current.start();
        setRecording(true);
      } catch {
        alert("Microphone access denied. Please enable it in browser settings.");
      }
    }
  };

  const endSession = async () => {
    if (!sessionId) return;
    try {
      await patientApi.endClinicSession(sessionId);
      addMessage("system", "Session ended. A summary has been saved to your records. Thank you!");
      setSessionId(null);
    } catch (e: any) {
      addMessage("system", "Session ended.");
      setSessionId(null);
    }
  };

  return (
    <PatientLayout>
      <div className="flex flex-col h-[calc(100vh-56px)] lg:h-screen max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900">Clinic Companion</h1>
              <p className="text-xs text-slate-400">
                {sessionId ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Session active
                  </span>
                ) : "Start a session to begin"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTtsEnabled(!ttsEnabled)}
              className={cn(
                "p-2 rounded-xl border transition-all",
                ttsEnabled ? "bg-crosscure-50 border-crosscure-200 text-crosscure-600" : "bg-slate-50 border-slate-200 text-slate-400"
              )}
              title="Toggle voice responses"
            >
              {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            {sessionId && (
              <button
                onClick={endSession}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium hover:bg-red-100 transition-all"
              >
                <PhoneOff className="w-4 h-4" /> End session
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6 pb-8">
              <div className="w-20 h-20 rounded-full gradient-bg flex items-center justify-center shadow-lg">
                <Stethoscope className="w-10 h-10 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Clinic Companion</h2>
                <p className="text-slate-500 max-w-sm text-sm">
                  I can help you recall your health history, formulate questions for your doctor, and understand medical information discussed in your appointment.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
                {[
                  "What medications am I currently taking?",
                  "What are my recent symptoms?",
                  "Help me ask about my diagnosis",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => { if (sessionId) sendMessage(s); }}
                    className="text-sm text-left px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-crosscure-50 hover:border-crosscure-200 text-slate-600 transition-all"
                    disabled={!sessionId}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {!sessionId && (
                <button className="btn-primary" onClick={startSession} disabled={starting}>
                  {starting ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting...</> : <><Phone className="w-4 h-4" /> Start Clinic Session</>}
                </button>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3 animate-fade-in",
                msg.role === "user" ? "flex-row-reverse" : "flex-row",
                msg.role === "system" ? "justify-center" : ""
              )}
            >
              {msg.role === "system" ? (
                <div className="bg-slate-100 text-slate-500 text-xs rounded-xl px-4 py-2 max-w-sm text-center">
                  {msg.content}
                </div>
              ) : (
                <>
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-bold",
                    msg.role === "user" ? "gradient-bg text-white" : "bg-teal-100 text-teal-700"
                  )}>
                    {msg.role === "user" ? "Y" : "AI"}
                  </div>
                  <div className={cn(
                    "max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                    msg.role === "user"
                      ? "gradient-bg text-white rounded-tr-none"
                      : "bg-white border border-slate-100 text-slate-800 rounded-tl-none"
                  )}>
                    {msg.content}
                  </div>
                </>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-xl bg-teal-100 flex items-center justify-center text-teal-700 text-sm font-bold flex-shrink-0">AI</div>
              <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center h-5">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        {sessionId && (
          <div className="bg-white border-t border-slate-100 p-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={handleVoice}
                disabled={transcribing}
                className={cn(
                  "voice-button w-12 h-12 rounded-xl flex-shrink-0",
                  recording ? "recording" : "",
                  transcribing ? "opacity-50" : ""
                )}
                title={recording ? "Stop recording" : "Start voice input"}
              >
                {transcribing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : recording ? (
                  <MicOff className="w-5 h-5" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </button>
              <input
                ref={inputRef}
                type="text"
                className="input-field flex-1"
                placeholder={recording ? "Recording... speak now" : "Type your message or use voice..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                disabled={recording || loading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="w-12 h-12 rounded-xl gradient-bg text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            {ttsPlaying && (
              <p className="text-xs text-crosscure-500 mt-2 flex items-center gap-1.5">
                <Volume2 className="w-3 h-3 animate-pulse" /> Speaking...
              </p>
            )}
          </div>
        )}
      </div>
    </PatientLayout>
  );
}
