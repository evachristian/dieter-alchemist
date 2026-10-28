#!/usr/bin/env python3
# 「같이 먹기」 컷씬의 밥상 — 사람이 보낸 그림을 «대고 따라 그려» mealart.js 로 굽는다.
#
#   pip install vtracer pillow
#   python3 -I tools/genmeal.py <받은 PNG> mealart.js
#
# ⚠️⚠️ **조각마다 «역할»을 붙인다** — 공주의 머리(hair)·원피스(dress)는 플레이어의 색으로
#    물들인다(사람이 정했다 · 모양은 그림 그대로). 역할은 «자리 + 빛깔»로 가른다:
#    · 머리 — 짙은 갈색이고 «얼굴 상자 밖»이다 (눈동자·입도 짙은 갈색이라 얼굴 안은 뺀다)
#    · 원피스 — 초록 빛깔이고 공주 쪽 · 어깨 아래다 (창가 화분 잎은 어깨 위라 안 걸린다)
# ⚠️ **김(steam)은 지운다** — 컷씬이 «피어오르는» 김을 따로 그린다. 따 둔 김이 남으면 두 겹이 된다
# ⚠️ **클레멘의 머리는 지운다** — 그 자리에 대화창 초상화의 머리를 얹는다(「원래 클레멘 모습으로」 ·
#    사람이 정했다). 머리 상자에 «통째로» 드는 조각만 지운다 — 목·옷까지 걸친 큰 조각은 남는다
# ⚠️ **오른쪽 아래 의자 위의 ✦ 는 그림 생성기의 낙인이다** — 지운다
import sys, re, json, colorsys
import vtracer

src, out = sys.argv[1], sys.argv[2]
tmp = out + '.tmp.svg'

# ── 따기 «전»에 그림에서 지운다 — 김 · ✦ 낙인
# ⚠️⚠️ **딴 뒤에 조각을 빼서는 못 지운다.** 겹쳐 쌓는(stacked) 따기라 ✦ 는 의자 조각의 «구멍»이고
#    김은 벽·소매 조각과 한 덩어리다 — 조각을 빼면 구멍이 그대로 남거나 벽이 같이 뚫린다.
#    그래서 픽셀을 먼저 고르고(가림막), 둘레 색으로 «번져 메운» 그림을 딴다
import numpy as np
from PIL import Image
img = np.asarray(Image.open(src).convert('RGB')).astype(float)
Hh, Ww = img.shape[:2]
mask = np.zeros((Hh, Ww), bool)
# ✦ — 의자(채도 0.5~0.6)보다 «바랜» 점 (채도 0.45 아래)
x0, y0, x1, y1 = 893, 632, 952, 692
sub = img[y0:y1, x0:x1]
mx, mn = sub.max(-1), sub.min(-1)
mask[y0:y1, x0:x1] = (mx - mn) / np.maximum(mx, 1) < 0.45
# 김 — 그 줄의 «바탕»(제일 흔한 색)보다 눈에 띄게 다르고 밝은 점. 벽 위에서는 바탕보다 어둡고
#    소매·선반 위에서는 바탕보다 밝아서, 「다르다」로 잡는다 (상자는 김 줄기에 바짝 붙였다)
for (bx0, by0, bx1, by1) in [(338, 342, 406, 423), (664, 376, 698, 440)]:
    for y in range(by0, by1):
        row = img[y, bx0 - 20:bx1 + 20]
        keys, cnt = np.unique((row // 6).astype(int), axis=0, return_counts=True)
        bg = keys[cnt.argmax()] * 6 + 3
        seg = img[y, bx0:bx1]
        mask[y, bx0:bx1] = (np.abs(seg - bg).max(-1) > 14) & (seg.min(-1) > 170)
# 밥상 위의 음식·그릇 — 컷씬이 «오늘의 밥상»(`MEAL_SETS` · game.js)을 그 자리에 따로 그린다
#    (「건강식 6세트를 날짜로 돌려 달라」 · 2026-10-15). 그릇 · 빵 바구니 · 컵 둘 · 소금·후추 · 숟가락.
#    ⚠️ 손은 남긴다 — 두 사람의 손이 그릇 가장자리에 닿아 있어서 그 상자는 가림막에서 뺀다
FOOD = [(374, 467, 64, 38), (358, 511, 62, 14), (449, 506, 29, 37), (516, 443, 70, 44),
        (607, 430, 28, 38), (575, 500, 44, 40), (672, 468, 68, 38),
        # 공주 숟가락 끝 · 그릇 테두리가 남던 띠 (손 오른쪽 · 그릇 위) — 「숟가락 자국도 지워줘」
        (372, 425, 52, 13)]
KEEP = [(280, 398, 320, 478), (664, 476, 748, 540)]
yy, xx = np.mgrid[0:Hh, 0:Ww]
for (cx, cy, rx, ry) in FOOD:
    mask |= ((xx - cx) / (rx + 8)) ** 2 + ((yy - cy) / (ry + 7)) ** 2 <= 1
for (kx0, ky0, kx1, ky1) in KEEP:
    mask[ky0:ky1, kx0:kx1] = False
# 테두리의 섞인 점까지 — 두 칸 넓힌다
for _ in range(2):
    m = mask.copy()
    m[1:] |= mask[:-1]; m[:-1] |= mask[1:]; m[:, 1:] |= mask[:, :-1]; m[:, :-1] |= mask[:, 1:]
    mask = m
# 번져 메우기 — 가림막 안의 점을 이웃의 평균으로 되풀이해 채운다 (바깥 색이 안으로 스민다)
out_img = img.copy()
known = ~mask
for _ in range(400):
    acc = np.zeros_like(out_img); n = np.zeros((Hh, Ww))
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        sh = np.roll(np.roll(out_img * known[..., None], dy, 0), dx, 1)
        kn = np.roll(np.roll(known, dy, 0), dx, 1)
        acc += sh; n += kn
    fill = mask & (n > 0)
    out_img[fill] = acc[fill] / n[fill][:, None]
    known = known | fill
clean = out + '.clean.png'
Image.fromarray(out_img.clip(0, 255).astype(np.uint8)).save(clean)
print(f'지운 점 {int(mask.sum())}')
src = clean

vtracer.convert_image_to_svg_py(src, tmp, colormode='color', hierarchical='stacked', mode='spline',
    filter_speckle=6, color_precision=6, layer_difference=12, corner_threshold=60, length_threshold=4.0,
    max_iterations=10, splice_threshold=45, path_precision=1)
s = open(tmp).read()
import os; os.remove(tmp)
clean_keep = clean   # 소매를 따로 딸 때 한 번 더 쓴다 (아래에서 지운다)
W, H = map(int, re.search(r'width="(\d+)" height="(\d+)"', s).groups())

HEAD = (672, 78, 908, 306)          # 클레멘 머리 — 이 상자에 통째로 드는 조각을 지운다
FACE = (232, 236, 380, 410)         # 공주 얼굴 — 이 안의 짙은 갈색은 눈·입이다 (머리가 아니다)
STEAM = [(330, 330, 410, 452), (650, 370, 705, 462)]
MARK = (893, 632, 952, 692)         # ✦ 낙인
PRINCESS_X = 480                    # 공주 쪽 (탁자 가운데보다 왼쪽)
inside = lambda b, r: r[0] >= b[0] and r[1] >= b[1] and r[2] <= b[2] and r[3] <= b[3]
hit = lambda b, r: not (r[2] < b[0] or r[0] > b[2] or r[3] < b[1] or r[1] > b[3])

def hsv(f):
    r, g, b = (int(f[i:i + 2], 16) / 255 for i in (1, 3, 5))
    return colorsys.rgb_to_hsv(r, g, b)

paths, drop = [], {'head': 0, 'steam': 0, 'mark': 0}
for d, f, tx, ty in re.findall(r'<path d="([^"]+)" fill="(#[0-9A-Fa-f]{6})" transform="translate\(([-\d.]+),([-\d.]+)\)"/>', s):
    tx, ty = float(tx), float(ty)
    # 옮김(translate)을 좌표에 굽는다 — 숫자 짝마다 더한다 (vtracer 는 M/C/L/Z 만 쓰고 절대 좌표다)
    k = [0]
    def mv(m):
        v = float(m.group(0)); k[0] += 1
        return ('%.1f' % (v + (tx if k[0] % 2 else ty))).rstrip('0').rstrip('.')
    d2 = re.sub(r'-?\d+(?:\.\d+)?', mv, d)
    n = [float(v) for v in re.findall(r'-?\d+(?:\.\d+)?', d2)]
    box = (min(n[0::2]), min(n[1::2]), max(n[0::2]), max(n[1::2]))
    f = f.lower()
    h, sat, val = hsv(f)
    if inside(HEAD, box):
        drop['head'] += 1; continue
    role = ''
    # 눈썹 — 얼굴 안 · 눈보다 위의 짙은 갈색. 공주가 «눈썹 문신»을 했을 때만 그린다 (사람이 정했다)
    if inside((236, 238, 372, 262), box) and val < 0.5:
        role = 'brow'
    elif box[0] < PRINCESS_X and 0.02 < h < 0.09 and val < 0.45 and sat > 0.4 \
            and not inside(FACE, box) and box[1] < 500:
        role = 'hair'
    elif box[0] < PRINCESS_X and box[1] > 100 and 0.15 < h < 0.32 and sat > 0.22 and val < 0.7:
        role = 'dress'
    # 손 — 그릇 가장자리에 닿은 두 사람의 손(과 쥔 숟가락)은 «오늘의 밥상» 위에 다시 그린다.
    #    안 그러면 새로 얹은 그릇이 손을 덮는다 (`KEEP` 상자에 통째로 드는 조각)
    if not role and any(inside((k[0] - 4, k[1] - 4, k[2] + 4, k[3] + 4), box) for k in KEEP):
        role = 'hand'
    paths.append([role, f, d2])

# ── 클레멘의 소매 — vtracer 가 «통째로» 빠뜨린다 (모든 겹에 구멍만 남고 채우는 조각이 없다 ·
#    「클레멘 팔도 사라졌어」 · 2026-10-29). 다른 조각은 그대로 두고 소매만 따로 따서 끼운다:
#    지운 그림에서 소매 빛깔(SLEEVE_RGB) 근처의 점을 가림막으로 떠 «흑백 따기»로 윤곽을 얻고,
#    셔츠 조각(같은 빛깔) 바로 «뒤»에 넣는다 — 그래야 소매의 금(짙은 선)과 손이 그 위에 선다
SLEEVE_BOX = (626, 352, 762, 472)
SLEEVE_RGB = (189, 156, 119)
sx0, sy0, sx1, sy1 = SLEEVE_BOX
sm = np.zeros((Hh, Ww), bool)
# ⚠️ «원본»에서 뜬다 — 지운 그림은 컵·그릇 자리를 둘레 색으로 번져 메워서, 거기서 뜨면 소매가
#    컵 자리까지 얼룩처럼 번진다 (그려 보고 알았다). 김 줄기가 지나가는 구멍은 닫기(팽창→침식)로 메운다
sm[sy0:sy1, sx0:sx1] = np.abs(img[sy0:sy1, sx0:sx1] - SLEEVE_RGB).max(-1) < 24
def grow(m, n, on):
    for _ in range(n):
        g = m.copy()
        if on:
            g[1:] |= m[:-1]; g[:-1] |= m[1:]; g[:, 1:] |= m[:, :-1]; g[:, :-1] |= m[:, 1:]
        else:
            g[1:] &= m[:-1]; g[:-1] &= m[1:]; g[:, 1:] &= m[:, :-1]; g[:, :-1] &= m[:, 1:]
        m = g
    return m
sm = grow(grow(sm, 9, True), 9, False)
bw = np.full((Hh, Ww), 255, np.uint8); bw[sm] = 0
bwp = out + '.sleeve.png'; Image.fromarray(bw).save(bwp)
vtracer.convert_image_to_svg_py(bwp, tmp, colormode='binary', mode='spline', filter_speckle=8,
    corner_threshold=60, length_threshold=4.0, splice_threshold=45, path_precision=1)
ss = open(tmp).read(); os.remove(tmp); os.remove(bwp); os.remove(clean_keep)
sleeve = []
for d, tx, ty in re.findall(r'<path d="([^"]+)" fill="#000000" transform="translate\(([-\d.]+),([-\d.]+)\)"/>', ss):
    tx, ty = float(tx), float(ty); k = [0]
    def mv2(m):
        v = float(m.group(0)); k[0] += 1
        return ('%.1f' % (v + (tx if k[0] % 2 else ty))).rstrip('0').rstrip('.')
    sleeve.append(re.sub(r'-?\d+(?:\.\d+)?', mv2, d))
sf = '#%02x%02x%02x' % SLEEVE_RGB
near = lambda f: max(abs(int(f[i:i + 2], 16) - c) for i, c in zip((1, 3, 5), SLEEVE_RGB)) < 10
at = next((i + 1 for i, (r, f, _) in enumerate(paths) if near(f)), len(paths))
paths[at:at] = [['', sf, d] for d in sleeve]
drop['sleeve+'] = len(sleeve)

roles = {}
for r, _, _ in paths:
    roles[r or '-'] = roles.get(r or '-', 0) + 1
art = {
    'vb': [0, 0, W, H],
    # 물들이는 기준색 — 조각마다 «이 색에서 얼마나 진하고 옅은가»를 지키며 새 색으로 옮긴다
    'base': {'hair': '#684431', 'dress': '#7a9258'},
    # 공주의 두 눈(깜박임) · 클레멘 머리 자리(초상화를 얹는다) · 김이 피어오르는 자리(그릇 위)
    # ⚠️ 공주의 눈은 그림 그대로 두지 않는다 — 흰자·속눈썹을 살색으로 덮고 아바타처럼
    #    «흰자 없는 동그란 눈동자 + 빛 두 점»을 다시 그린다 (「흰자와 속눈썹 없는 버전으로」 · 사람이 정했다).
    #    덮개(eyeCover)는 흰자·속눈썹까지 다 덮는 크기, 눈동자(eyes)는 깜박임 눈꺼풀도 같이 쓴다.
    #    눈썹(y 245~258)은 덮개 위라 그대로 남는다 (4배로 키워 재서 골랐다)
    'eyeCover': [[266, 284.5, 27, 23], [343, 280, 21, 22]],
    # 눈동자는 «크게» — 아바타처럼 얼굴에서 눈이 주인공이 되게 (「눈동자 더 키워줘」 · 사람이 정했다 · 1.3배)
    'eyes': [[273, 285, 19.5, 23], [345, 281, 17, 21]],
    'pupil': '#3d2a22',
    # 눈썹을 안 그릴 때 덮는 살색 — 눈썹 밑에 «조금 진한 살색» 테 조각이 깔려 있어서 눈썹만 빼면
    # 오른쪽 눈썹 자국이 옅게 남았다 (그려 보고 알았다)
    'browCover': [[265, 253, 23, 10], [345, 250, 18, 9]],
    'eyelid': '#f9ccb4',
    # 허리 — 원피스가 아니라 상의+하의를 입었으면 이 줄 위는 상의 색, 아래는 하의 색이다.
    # 소매 끝(팔꿈치) 바로 밑 · 무릎이 시작하는 자리라 곧은 줄이 «허리선»으로 읽힌다 (그려 놓고 골랐다)
    'waist': 505,
    'head': {'cx': 790, 'chin': 302, 'w': 236},
    'steam': [[372, 438, 1.0], [681, 452, 0.9], [517, 418, 0.6]],
    # 오늘의 밥상을 얹는 자리 — 지운 그릇·바구니·컵의 자리 그대로다 (공주 그릇 · 클레멘 그릇 · 가운데 · 컵 둘)
    'food': {'pr': [372, 468, 82], 'cl': [676, 468, 84], 'mid': [516, 448, 70], 'cupA': [452, 516], 'cupB': [608, 430]},
    'paths': paths,
}
js = ('// 「같이 먹기」 컷씬의 밥상 — 생성 파일이다 (python3 -I tools/genmeal.py <받은 PNG> mealart.js).\n'
      '// 손으로 고치지 않는다. 역할: hair·dress 는 플레이어 색으로 물들이고, 나머지는 그대로 칠한다.\n'
      'window.MealArt = ' + json.dumps(art, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(out, 'w').write(js)
print(f'{len(paths)}조각 · 역할 {roles} · 지운 것 {drop} · {len(js) // 1024}KB')
