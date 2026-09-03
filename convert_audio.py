import av
import wave

container = av.open('D:/FSadvisory-crm/Audio.ogg')
stream = container.streams.audio[0]
resampler = av.AudioResampler(format='s16', layout='mono', rate=16000)

pcm_bytes = bytearray()
for frame in container.decode(stream):
    resampled_frames = resampler.resample(frame)
    for rf in resampled_frames:
        pcm_bytes.extend(rf.to_ndarray().tobytes())

# flush resampler
resampled_frames = resampler.resample(None)
for rf in resampled_frames:
    pcm_bytes.extend(rf.to_ndarray().tobytes())

wav_file = wave.open('D:/FSadvisory-crm/audio.wav', 'wb')
wav_file.setnchannels(1)
wav_file.setsampwidth(2)
wav_file.setframerate(16000)
wav_file.writeframes(pcm_bytes)
wav_file.close()

duration_sec = len(pcm_bytes) / (16000 * 2)
print(f"Successfully converted Audio.ogg to audio.wav! Duration: {duration_sec:.2f} seconds")
