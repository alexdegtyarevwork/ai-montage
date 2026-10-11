# Звук: темп и доли, начала событий с силой, громкостью и частотным балансом (низ/середина/верх), огибающие по 0,25 с.
#   python -I md_audio.py <файл.wav>
import sys, json, numpy as np, librosa
p = sys.argv[1]
y, sr = librosa.load(p, sr=22050, mono=True)
hop = 256
dur = len(y) / sr
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, hop_length=hop)
bt = librosa.frames_to_time(beats, sr=sr, hop_length=hop)
oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
on = librosa.onset.onset_detect(onset_envelope=oenv, sr=sr, hop_length=hop, backtrack=False, delta=0.25)
ot = librosa.frames_to_time(on, sr=sr, hop_length=hop)
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
rms = librosa.feature.rms(S=S)[0]
cent = librosa.feature.spectral_centroid(S=S, sr=sr)[0]
def band(lo, hi):
    m = (freqs >= lo) & (freqs < hi); return S[m].sum(0)
low, mid, high = band(20, 150), band(150, 2000), band(2000, 11000)
tot = low + mid + high + 1e-9
print(p.split('/')[-1], 'dur', round(dur, 2), 'tempo', np.round(tempo, 1))
print('beats', ' '.join(f'{t:.2f}' for t in bt))
db = librosa.amplitude_to_db(rms, ref=np.max)
print('onsets (t | strength | rms dB | centroid Hz | low/mid/high %):')
for f, t in zip(on, ot):
    print(f'  {t:6.2f}  s={oenv[f]:5.1f}  {db[f]:6.1f}dB  c={cent[f]:6.0f}  L{100*low[f]/tot[f]:3.0f} M{100*mid[f]/tot[f]:3.0f} H{100*high[f]/tot[f]:3.0f}')
# loudness envelope per 0.25s
seg = int(0.25 * sr / hop)
env = [float(np.mean(db[i:i+seg])) for i in range(0, len(db), seg)]
print('env0.25s', ' '.join(f'{e:.0f}' for e in env))
lowenv = [float(np.mean(low[i:i+seg] / tot[i:i+seg] * 100)) for i in range(0, len(db), seg)]
print('low%0.25s', ' '.join(f'{e:.0f}' for e in lowenv))
cenv = [float(np.mean(cent[i:i+seg])) for i in range(0, len(db), seg)]
print('cent0.25s', ' '.join(f'{e/1000:.1f}' for e in cenv))
