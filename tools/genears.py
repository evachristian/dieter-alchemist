# 서클렛의 «동물 귀 머리띠» 여섯을 받은 그림에서 따낸다 → earart.js (window.EarArt)
#
#   python3 -I tools/genears.py              # tools/ref/ears.webp 를 읽어 earart.js 를 다시 쓴다
#   python3 -I tools/genears.py --check      # 다시 뽑은 것과 파일이 같은가 (vtracer 가 있어야 해서 npm test 는 안 돌린다)
#   pip install vtracer pillow numpy
#
# 받은 그림(사람이 보낸 표 한 장 · 3 × 2 칸)을 **그대로 대고** 딴다 — 손으로 그리지 않는다.
# ⚠️ 좌표는 «그 칸의 얼굴»에 맞춰 아바타 얼굴(가운데 x100 · 꼭대기 y35 · 반폭 33)로 옮긴다.
#    그래서 머리띠가 아바타 머리에 그 그림 그대로의 자리로 앉는다
# ⚠️ 머리카락(진분홍)·얼굴(살색)·바탕(흰색)을 빼고 남는 것이 머리띠다 — 얼굴 꼭대기 «위»는
#    살색도 남긴다(토끼 귀 속이 살색과 거의 같은 크림색이다)
import sys, re, os
import numpy as np
from PIL import Image, ImageFilter
import vtracer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'ref', 'ears.webp')
OUT = os.path.join(ROOT, 'earart.js')
TMP = os.environ.get('TMPDIR', '/tmp')

im = np.asarray(Image.open(SRC).convert('RGB')).astype(int)
Hh, W, _ = im.shape

# 칸 — [이름, 얼굴 가운데 x, 얼굴 꼭대기 y, 얼굴 반폭(px), 칸 위 y]
# ⚠️ 얼굴은 살색 블롭에서 «재서» 적었다 (토끼만 귀 속이 살색이라 옆 칸의 꼭대기를 쓴다)
CELLS = [
    ('cat',     198.5, 151,  84, 0),
    ('rabbit',  518.0, 151,  84, 0),
    ('raccoon', 839.0, 151,  84, 0),
    ('dog',     198.5, 478,  77, 415),
    ('bear',    518.0, 478,  82, 415),
    ('fox',     841.0, 478,  83, 415),
]
FACE_RX, FACE_TOP = 33, 35            # 아바타 얼굴 (avatar.js 의 ellipse cx100 cy70 rx33 ry35)
SINK = 6                               # ⚠️ 받은 그림은 머리카락이 얼굴 위로 두껍게 솟아(얼굴 반폭 기준 ~19칸 · 아바타는 ~9칸)
                                       #    얼굴에만 맞추면 띠가 머리 위에 떠 있었다 — 그 차만큼 통째로 내린다 (6·4·7 을 그려 보고 골랐다)
UP = 2
K, MERGE = 9, 80                    # 묶을 색 수 · 이보다 가까우면 한 색
PART_MIN = 200                      # 이보다 작은 동떨어진 조각은 머리띠가 아니다
HOLE_MAX = 900                      # 여우 귀 속 흰 털(~400px)은 메우고, 머리카락 자리는 안 메운다

r, g, b = im[..., 0], im[..., 1], im[..., 2]
bg = (np.minimum(np.minimum(r, g), b) > 236)
hair = (r > 200) & (g < 165) & (b > 100) & (r - g > 75)
skin = np.abs(im - np.array([253, 217, 190])).sum(2) < 34

def fill_holes(m):
    # 바깥에서 흘려 닿지 않는 빈 자리 = 구멍 (여우 귀 속의 흰 털)
    from collections import deque
    h, w = m.shape; seen = np.zeros_like(m); q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not m[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if not m[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and not m[yy, xx] and not seen[yy, xx]:
                seen[yy, xx] = True; q.append((yy, xx))
    # ⚠️ **작은** 구멍만 메운다 — 띠와 귀 사이에 갇힌 머리카락 자리까지 메우면 귀가 덩어리가 된다
    hole = ~m & ~seen
    lab = np.zeros(m.shape, int); n = 0; out = m.copy()
    for y in range(h):
        for x in range(w):
            if hole[y, x] and not lab[y, x]:
                n += 1; q = deque([(y, x)]); lab[y, x] = n; pts = []
                while q:
                    yy, xx = q.popleft(); pts.append((yy, xx))
                    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                        a, c = yy + dy, xx + dx
                        if 0 <= a < h and 0 <= c < w and hole[a, c] and not lab[a, c]:
                            lab[a, c] = n; q.append((a, c))
                if len(pts) < HOLE_MAX:
                    for a, c in pts: out[a, c] = True
    return out

def big_parts(m, nmin):
    from collections import deque
    h, w = m.shape; seen = np.zeros_like(m); out = np.zeros_like(m)
    for y in range(h):
        for x in range(w):
            if m[y, x] and not seen[y, x]:
                q = deque([(y, x)]); seen[y, x] = True; pts = []
                while q:
                    a, c = q.popleft(); pts.append((a, c))
                    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                        aa, cc = a + dy, c + dx
                        if 0 <= aa < h and 0 <= cc < w and m[aa, cc] and not seen[aa, cc]:
                            seen[aa, cc] = True; q.append((aa, cc))
                if len(pts) >= nmin:
                    for a, c in pts: out[a, c] = True
    return out

def morph(m, k, op):
    f = ImageFilter.MinFilter(k) if op == 'min' else ImageFilter.MaxFilter(k)
    return np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(f)) > 127

out = {}
for name, cx, top, rx, y0 in CELLS:
    x0, x1 = int(cx - 175), int(cx + 175)
    y1 = int(top + rx * 1.4)                  # 강아지 귀는 볼 옆까지 늘어진다
    sub = im[y0:y1, x0:x1]
    above = np.zeros(sub.shape[:2], bool); above[:max(0, top - y0), :] = True
    m = ~bg[y0:y1, x0:x1] & ~hair[y0:y1, x0:x1] & (above | ~skin[y0:y1, x0:x1])
    # 눈썹 아래는 «얼굴 옆»만 본다 — 눈·눈썹을 머리띠로 집지 않게 (늘어진 귀만 거기까지 온다)
    yy, xx = np.mgrid[y0:y0 + sub.shape[0], x0:x0 + sub.shape[1]]
    m &= (yy < top + rx * 0.45) | (np.abs(xx - cx) > rx * 0.8)
    m = morph(morph(m, 5, 'min'), 5, 'max') & ~bg[y0:y1, x0:x1]   # 머리카락 테두리의 실오라기를 뗀다
    m = fill_holes(m)
    m = big_parts(m, PART_MIN)                # 볼터치·눈썹 끝 같은 동떨어진 조각을 버린다
    # 작은 조각은 버린다
    # ── 색을 «직접» 고른다 — vtracer 의 색 묶기에 맡기면 바탕(흰색)이 넓어 귀 속 분홍까지 한 색으로
    #    뭉개졌다 (고양이 귀가 테두리만 남았다). 칠한 자리의 색을 k-평균으로 몇 가지로 묶고,
    #    색마다 따로 «이진»으로 딴다
    # ⚠️ 바탕과 맞닿은 테두리 한 줄은 «흰색과 섞인» 색이라 묶음에서 뺀다 — 넣으면 연한 테두리가
    #    제 색 하나를 차지해 귀 둘레에 흰 테가 생겼다. 그 자리는 안쪽 이웃의 색을 물려받는다
    inner = morph(m, 3, 'min')
    px = sub[inner].astype(float)
    rng = np.random.default_rng(7)
    cen = px[rng.choice(len(px), K, replace=False)]
    for _ in range(25):
        lab_ = ((px[:, None, :] - cen[None]) ** 2).sum(2).argmin(1)
        cen = np.array([px[lab_ == i].mean(0) if (lab_ == i).any() else cen[i] for i in range(K)])
    # 너무 가까운 색은 하나로 (같은 털이 두 갈래로 갈리지 않게)
    keep = []
    for i in np.argsort([-(lab_ == j).sum() for j in range(K)]):
        if (lab_ == i).sum() < 15: continue
        if all(np.abs(cen[i] - cen[j]).sum() > MERGE for j in keep): keep.append(i)
    # ⚠️ 테두리에만 사는 색(진한 윤곽과 바탕이 섞인 중간색)은 버린다 — 남기면 귀 둘레가
    #    얼룩덜룩한 «테»로 따졌다. 속(5px 안쪽)에 제 몫이 거의 없는 색이 그것이다
    core = morph(m, 7, 'min')[inner]
    solid = [i for i in keep if (core[lab_ == i]).sum() >= 0.25 * (lab_ == i).sum() or (lab_ == i).sum() > 4000]
    # ⚠️ 단 «어느 속 색과도 먼» 색은 테두리가 아니라 가는 장식이다 (고양이 방울의 노란 리본) —
    #    버리면 그 자리가 가장 가까운 분홍을 물려받아 얼굴 옆에 분홍 부스러기로 남았다
    keep = solid + [i for i in keep if i not in solid and all(np.abs(cen[i] - cen[j]).sum() > 160 for j in solid)]
    cen = cen[keep]
    if os.environ.get("EARS_DEBUG"): print(name, [tuple(int(v) for v in c) for c in cen], int(m.sum()))
    lab_ = ((px[:, None, :] - cen[None]) ** 2).sum(2).argmin(1)
    L = np.full(m.shape, -1); L[inner] = lab_
    for _ in range(6):                        # 테두리는 안쪽 이웃의 색을 물려받는다
        todo = m & (L < 0)
        if not todo.any(): break
        for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
            sh = np.roll(np.roll(L, dy, 0), dx, 1)
            take = todo & (L < 0) & (sh >= 0)
            L[take] = sh[take]
    m &= L >= 0
    s = FACE_RX / rx
    parts = []
    # 넓은 색부터 깔고 좁은 색을 얹는다 · 각 색은 1px 넓혀 이음매가 안 비치게 한다
    order = sorted(range(len(cen)), key=lambda i: -(L == i).sum())
    for i in order:
        mi = morph(L == i, 3, 'max') & m if i == order[0] else morph(L == i, 3, 'max') & morph(m, 3, 'max')
        mi = np.asarray(Image.fromarray((mi * 255).astype(np.uint8)).resize((mi.shape[1] * UP, mi.shape[0] * UP), Image.BILINEAR)
             .filter(ImageFilter.GaussianBlur(0.8 * UP))) > 127
        pth = os.path.join(TMP, '_ears_%s_%d.png' % (name, i)); svp = pth.replace('.png', '.svg')
        Image.fromarray(np.where(mi, 0, 255).astype(np.uint8)).convert('RGB').save(pth)
        vtracer.convert_image_to_svg_py(pth, svp, colormode='binary', mode='spline', filter_speckle=7 * UP,   # ⚠️ 한 변의 px 다 — 40 으로 두면 큰 조각까지 통째로 사라졌다
           
            corner_threshold=60, length_threshold=4.0, splice_threshold=45, path_precision=1)
        col = '#%02x%02x%02x' % tuple(int(round(v)) for v in cen[i])
        for d_, f, tx, ty in re.findall(r'<path d="([^"]*)" fill="#([0-9A-Fa-f]{6})"(?: transform="translate\(([-\d.]+),([-\d.]+)\)")?/>', open(svp).read()):
            if f.upper() != '000000':
                continue
            tx, ty = float(tx or 0), float(ty or 0)
            k = [0]
            def bake(mm):
                v = float(mm.group(0))
                if k[0] % 2 == 0:
                    v = 100 + ((v + tx) / UP + x0 - cx) * s
                else:
                    v = FACE_TOP + SINK + ((v + ty) / UP + y0 - top) * s
                k[0] += 1
                return ('%.1f' % v).rstrip('0').rstrip('.')
            parts.append('<path d="%s" fill="%s"/>' % (re.sub(r'-?\d+(?:\.\d+)?', bake, d_).replace(' Z ', 'Z').strip(), col))
    base = '#%02x%02x%02x' % tuple(int(round(v)) for v in cen[order[0]])
    out[name] = (base, ''.join(parts))

js = ['// ⚠️ 생성된 파일이다 — 손으로 고치지 않는다 (tools/genears.py · 받은 그림 tools/ref/ears.webp)',
      '// 서클렛의 동물 귀 머리띠 여섯. 좌표는 아바타 머리 좌표계(얼굴 가운데 x100 · 꼭대기 y35)다',
      '// base = 제일 넓은 색 — 옷장의 원래 색이자 염색할 때 «얼마나 옮길지»의 기준이다 (genwardrobe 가 읽는다)',
      'window.EarArt = {']
for k, (base, v) in out.items():
    js.append("  %s: { base: '%s', svg: '%s' }," % (k, base, v))
js.append('};\n')
text = '\n'.join(js)
if '--check' in sys.argv:
    cur = open(OUT).read() if os.path.exists(OUT) else ''
    if cur != text:
        print('❌ earart.js 가 tools/genears.py 의 결과와 다르다 — python3 -I tools/genears.py 로 다시 뽑을 것'); sys.exit(1)
    print('✅ earart.js — 머리띠 %d개가 생성 결과와 같다' % len(out)); sys.exit(0)
open(OUT, 'w').write(text)
print('✅ earart.js — %s' % ' · '.join('%s %d조각' % (k, v[1].count('<path')) for k, v in out.items()))
