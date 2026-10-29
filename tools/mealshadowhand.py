# 같이 먹기 그림자 마스크(mealshadow.png)에 클레멘의 «숟가락 든 손»을 채운다 (2026-10-29 · 「숟가락 든 손 흐린 것도 고쳐줘」).
# 손을 사람으로 안 쳐서 클레멘 몸의 그림자가 손 위에 드리워 흐려 보였다 — 원본 PNG 에서 살색·숟가락·소매 빛깔을 떠 OR 한다.
# 쓰는 법: python3 -I tools/mealshadowhand.py <원본 PNG> <옛 mealshadow.png> mealshadow.png  (두 번 해도 같다)
import sys, numpy as np
from PIL import Image
src = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(int)
m = Image.open(sys.argv[2]); a = np.asarray(m.getchannel('A')).copy()
x0,y0,x1,y1 = 600,312,760,420
box = src[y0:y1, x0:x1]
skin = (box[...,0] - box[...,2] > 60) & (box[...,0] > 200)
mx, mn = box.max(-1), box.min(-1)
spoon = (mx < 185) & (mx - mn < 20)          # 숟가락의 회색 (창턱 띠는 이보다 밝다)
bowl = (box[...,0] - box[...,2] > 50) & (box[...,0] > 190)   # 숟가락 위 수프
sleeve = np.abs(box - np.array([189,156,119])).sum(-1) < 50
hm = skin | spoon | bowl | sleeve
print('hand px', hm.sum())
big = np.zeros(src.shape[:2], bool); big[y0:y1, x0:x1] = hm
sm = np.asarray(Image.fromarray((big*255).astype(np.uint8)).resize(m.size, Image.BILINEAR)) > 60
a = np.maximum(a, sm.astype(np.uint8)*255)
out = np.asarray(m).copy(); out[...,3] = a
Image.fromarray(out).save(sys.argv[3])
