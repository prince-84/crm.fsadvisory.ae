import wave
import numpy as np
import whisper

print("Reading audio.wav into numpy float32 array...")
wf = wave.open("D:/FSadvisory-crm/audio.wav", "rb")
n_frames = wf.getnframes()
frames = wf.readframes(n_frames)
wf.close()

# Convert int16 PCM bytes to float32 normalized [-1.0, 1.0]
audio_int16 = np.frombuffer(frames, dtype=np.int16)
audio_float32 = audio_int16.astype(np.float32) / 32768.0

print(f"Loaded {len(audio_float32)} audio samples ({len(audio_float32)/16000:.2f} seconds)")

print("Loading Whisper model (tiny)...")
model = whisper.load_model("tiny")

print("Transcribing audio array...")
result = model.transcribe(audio_float32, fp16=False)

text = result.get("text", "")
language = result.get("language", "")

print("\n" + "="*50)
print("Language Detected:", language)
print("Transcript Text:\n")
print(text)
print("="*50 + "\n")

with open("D:/FSadvisory-crm/transcript.txt", "w", encoding="utf-8") as f:
    f.write(f"Language Detected: {language}\n\n{text}")

print("Saved transcript to D:/FSadvisory-crm/transcript.txt")
