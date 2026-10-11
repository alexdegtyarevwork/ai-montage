# После разделения htdemucs: уровни голос/музыка/ударные/бас/прочее по 0,5 с, начала событий в ударных и «прочем»,
# громкость музыки под голосом и без него.  md_stems.py <метка> <папка дорожек> <папка разбора>
import sys, json, numpy as np, librosa, soundfile as sf
v = sys.argv[1]; base = sys.argv[2]; sp = sys.argv[3]
st = {}
for k in ['vocals', 'drums', 'bass', 'other']:
    y, sr = librosa.load(f'{base}/{k}.wav', sr=22050, mono=True); st[k] = y
music = st['drums'] + st['bass'] + st['other']
sf.write(f'{sp}/{v}.music.wav', music, 22050)
hop = 512; sr = 22050
def rms_db(y):
    r = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop)[0]; return 20 * np.log10(r + 1e-6)
R = {k: rms_db(y) for k, y in st.items()}; R['music'] = rms_db(music)
t = librosa.frames_to_time(np.arange(len(R['music'])), sr=sr, hop_length=hop)
# per 0.5s table
print(f'== {v}: per 0.5 s  vocals | music | drums | bass | other (dBFS)')
rows = []
for a in np.arange(0, t[-1], 0.5):
    m = (t >= a) & (t < a + 0.5)
    rows.append(f'{a:5.1f} V{R["vocals"][m].mean():6.1f} M{R["music"][m].mean():6.1f} D{R["drums"][m].mean():6.1f} B{R["bass"][m].mean():6.1f} O{R["other"][m].mean():6.1f}')
print('\n'.join(rows))
# onsets in drums and other
for k in ['drums', 'other']:
    oenv = librosa.onset.onset_strength(y=st[k], sr=sr, hop_length=256)
    on = librosa.onset.onset_detect(onset_envelope=oenv, sr=sr, hop_length=256, delta=0.3, units='time')
    print(f'{k} onsets:', ' '.join(f'{x:.2f}' for x in on))
# vocal active ratio & music level when vocal active vs not
va = R['vocals'] > -35
print('music dB when VO active: %.1f, when VO silent: %.1f' % (R['music'][va].mean(), R['music'][~va].mean()))
print('vocals mean active dB %.1f' % R['vocals'][va].mean())
