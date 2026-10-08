#!/usr/bin/env python3
# 「혼자 먹은 밤」의 웅크린 뒷모습 — 사람이 보낸 그림을 «대고 따라 그려» crouchart.js 로 굽는다.
#
#   pip install vtracer pillow numpy
#   python3 -I tools/gencrouch.py <받은 PNG> crouchart.js
#
# ⚠️⚠️ **그림에서 바로 따면 색을 못 갈아 끼운다.** 가장자리마다 섞인 색(머리+옷 = 카키 등)이
#    수십 가지 생겨, 어느 것이 «옷»이고 어느 것이 «머리»인지 정할 수가 없다.
#    그래서 ① 픽셀마다 **역할 팔레트**(머리·머리선·옷·옷선·살·살선·신발·케이크)의
#    제일 가까운 색으로 먼저 눌러 놓고 ② 그것을 따고 ③ 따인 조각마다 역할을 붙인다.
#    역할이 있어야 avatar.js 가 착장의 색(머리·옷·신발)으로 갈아 칠한다.
# ⚠️ 케이크 색은 **케이크 상자 안에서만** 쓴다 — 밖에서 쓰면 살·크림이 서로 넘나든다.
#    부스러기 자리에서만 스펀지 색을 하나 더 허락한다.
import sys, re, json
import numpy as np
from PIL import Image
import vtracer

src, out = sys.argv[1], sys.argv[2]
BASE = {'bg': (254, 254, 254), 'hair': (0x6F, 0x4A, 0x35), 'hairL': (0x55, 0x31, 0x19),
        'cloth': (0x7B, 0x96, 0x5E), 'clothL': (0x5D, 0x78, 0x41),
        'skin': (0xFB, 0xD0, 0xB5), 'skinL': (0xE0, 0xA0, 0x80), 'shoe': (0x3F, 0x34, 0x36)}
CAKE = {'sponge': (0xF9, 0xA6, 0x65), 'cream': (0xFC, 0xEC, 0xDC),
        'straw': (0xD3, 0x3D, 0x49), 'leaf': (0x6F, 0x95, 0x3B)}
CAKE_BOX = (240, 400, 412, 612)          # x0 y0 x1 y1 — 들고 있는 케이크(+그 손)
CRUMB_BOX = (0, 830, 330, 1024)          # 바닥의 부스러기
names = list(BASE) + list(CAKE)
pal = np.array([BASE[k] for k in BASE] + [CAKE[k] for k in CAKE])

im = np.asarray(Image.open(src).convert('RGB')).astype(int)
H, W, _ = im.shape
yy, xx = np.mgrid[0:H, 0:W]
inbox = lambda b: (xx >= b[0]) & (yy >= b[1]) & (xx <= b[2]) & (yy <= b[3])
cake, crumb = inbox(CAKE_BOX), inbox(CRUMB_BOX)
d = ((im[:, :, None, :] - pal[None, None, :, :]) ** 2).sum(-1)
for i, k in enumerate(names):
    if k in CAKE:
        d[:, :, i] = np.where(cake | (crumb if k == 'sponge' else False), d[:, :, i], 10 ** 9)
Image.fromarray(pal[d.argmin(-1)].astype(np.uint8)).save('/tmp/_crouch_q.png')

vtracer.convert_image_to_svg_py('/tmp/_crouch_q.png', '/tmp/_crouch_q.svg', colormode='color',
    hierarchical='stacked', mode='spline', filter_speckle=4, color_precision=8, layer_difference=1,
    corner_threshold=60, length_threshold=4.0, max_iterations=10, splice_threshold=45, path_precision=1)
svg = open('/tmp/_crouch_q.svg').read()

parts = []
pat = r'<path d="([^"]*)" fill="#([0-9A-Fa-f]{6})"(?: transform="translate\(([-\d.]+),([-\d.]+)\)")?/>'
for d_, f, tx, ty in re.findall(pat, svg):
    tx, ty = float(tx or 0), float(ty or 0)
    rgb = np.array([int(f[i:i + 2], 16) for i in (0, 2, 4)])
    nums = [float(v) for v in re.findall(r'-?\d+(?:\.\d+)?', d_)]
    xs, ys = nums[0::2], nums[1::2]
    cx = (min(xs) + max(xs)) / 2 + tx; cy = (min(ys) + max(ys)) / 2 + ty
    in_cake = CAKE_BOX[0] <= cx <= CAKE_BOX[2] and CAKE_BOX[1] <= cy <= CAKE_BOX[3]
    in_crumb = CRUMB_BOX[0] <= cx <= CRUMB_BOX[2] and CRUMB_BOX[1] <= cy <= CRUMB_BOX[3]
    ok = [k for k in names if k not in CAKE or in_cake or (k == 'sponge' and in_crumb)]
    role = min(ok, key=lambda k: ((pal[names.index(k)] - rgb) ** 2).sum())
    if role == 'bg':
        continue
    # 케이크 상자 안의 살색 조각은 셋 중 하나다 (재서 갈랐다):
    #  · 아래쪽(y ≥ 528) — 케이크를 받친 **손** → «먹는 팔» 묶음(케이크와 같이 움직인다)
    #  · 오른쪽 위(x > 345 · y < 440) — 볼의 «씹는 자국» → 얼굴이다 (안 움직인다)
    #  · 나머지 — 살색과 비슷한 **케이크 크림·스펀지 그늘** → 케이크
    # ⚠️ 이것을 안 가르면 이모지로 바꿨을 때 크림 조각이 음식 위에 흰 자국으로 남는다
    if role in ('skin', 'skinL') and in_cake:
        if cy >= 528:
            role = 'hand' if role == 'skin' else 'handL'
        elif not (cx > 345 and cy < 440):
            role = 'cream' if role == 'skin' else 'cakeL'
    if role == 'sponge' and in_crumb:
        role = 'crumb'
    # 좌표에 translate 를 녹여 넣는다 (M·C 뿐이라 짝마다 더하면 된다)
    k = [0]
    def bake(m):
        v = float(m.group(0)) + (tx if k[0] % 2 == 0 else ty); k[0] += 1
        return ('%.1f' % v).rstrip('0').rstrip('.')
    parts.append([role, re.sub(r'-?\d+(?:\.\d+)?', bake, d_).replace(' Z ', 'Z').strip()])

js = ('// ⚠️ 생성 파일이다 — 손으로 고치지 않는다. tools/gencrouch.py 가 굽는다.\n'
      '// 「혼자 먹은 밤」의 웅크린 뒷모습 (사람이 보낸 그림을 대고 따라 그린 것) → window.CrouchArt\n'
      '// 좌표는 받은 그림(1024×1024) 그대로다. 조각마다 «역할»이 붙어 있어 avatar.js 의\n'
      '// crouchBack 이 착장의 색으로 갈아 칠한다.\n'
      'window.CrouchArt = ' + json.dumps({'parts': parts}, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(out, 'w').write(js)
from collections import Counter
print(len(js), Counter(p[0] for p in parts))
