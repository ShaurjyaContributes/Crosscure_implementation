/**
 * Cartesia voice integration — STT and TTS using Cartesia's API.
 * STT: ink-whisper model via /audio/transcriptions
 * TTS: sonic-3 model via /tts/bytes (streamed)
 */

const CARTESIA_API_KEY = process.env.NEXT_PUBLIC_CARTESIA_API_KEY || '';
const CARTESIA_VERSION = process.env.NEXT_PUBLIC_CARTESIA_VERSION || '2026-03-01';
const CARTESIA_VOICE_ID = process.env.NEXT_PUBLIC_CARTESIA_VOICE_ID || '694f9389-aac1-45b6-b726-9d9369183238';
const CARTESIA_TTS_MODEL = process.env.NEXT_PUBLIC_CARTESIA_TTS_MODEL || 'sonic-3';
const CARTESIA_STT_MODEL = process.env.NEXT_PUBLIC_CARTESIA_STT_MODEL || 'ink-whisper';
const CARTESIA_BASE = 'https://api.cartesia.ai';

export interface TranscriptResult {
  text: string;
  confidence?: number;
}

/**
 * Transcribe audio blob using Cartesia ink-whisper.
 */
export async function transcribeAudio(audioBlob: Blob): Promise<TranscriptResult> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', CARTESIA_STT_MODEL);

  const response = await fetch(`${CARTESIA_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'X-API-Key': CARTESIA_API_KEY,
      'Cartesia-Version': CARTESIA_VERSION,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cartesia STT error: ${error}`);
  }

  const data = await response.json();
  return {
    text: data.text || data.transcript || '',
    confidence: data.confidence,
  };
}

/**
 * Synthesize speech using Cartesia sonic-3, returns an audio URL.
 */
export async function synthesizeSpeech(text: string): Promise<string> {
  const response = await fetch(`${CARTESIA_BASE}/tts/bytes`, {
    method: 'POST',
    headers: {
      'X-API-Key': CARTESIA_API_KEY,
      'Cartesia-Version': CARTESIA_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: CARTESIA_TTS_MODEL,
      transcript: text,
      voice: {
        mode: 'id',
        id: CARTESIA_VOICE_ID,
      },
      output_format: {
        container: 'mp3',
        encoding: 'mp3',
        sample_rate: 44100,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cartesia TTS error: ${error}`);
  }

  const audioBuffer = await response.arrayBuffer();
  const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
  return URL.createObjectURL(blob);
}

/**
 * Play text as speech using Cartesia TTS.
 */
export async function speakText(text: string): Promise<void> {
  try {
    const url = await synthesizeSpeech(text);
    const audio = new Audio(url);
    return new Promise((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.onerror = reject;
      audio.play();
    });
  } catch (error) {
    console.warn('TTS failed, continuing without audio:', error);
  }
}

/**
 * Record audio from microphone and return as a Blob.
 */
export function createAudioRecorder() {
  let mediaRecorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];

  return {
    async start() {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      
      // Prefer webm format for broad compatibility
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg';
      
      mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.start(100); // collect data every 100ms
      return stream;
    },

    stop(): Promise<Blob> {
      return new Promise((resolve) => {
        if (!mediaRecorder) {
          resolve(new Blob());
          return;
        }
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mediaRecorder!.mimeType });
          // Stop all tracks
          resolve(blob);
        };
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach((t) => t.stop());
      });
    },

    get isRecording() {
      return mediaRecorder?.state === 'recording';
    },
  };
}
