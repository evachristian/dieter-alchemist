# 따낸 윤곽을 «선 자체»로 매끈하게 편다 — genears.py · gencrouch.py 가 같이 쓴다
#
# ⚠️ 받은 그림이 작아서(귀 하나가 ~100px) 아무리 늘려 흐려 따도 윤곽에 원본의 울퉁불퉁함이 남았다
#    (「하나도 안 깔끔해 · 매끈하게 다듬어 줘」 · 신고받았다). 래스터를 흐리는 것으로는 한계가 있어서
#    윤곽 «점»을 고르게 다시 찍고(resample) 둘레를 따라 가우시안으로 편 뒤 Catmull-Rom 곡선으로 잇는다.
#    ⚠️ 펴는 몫(sig)은 «원본 px» 로 준다 — 크면 고양이·여우 귀끝이 뭉툭해진다
import re
import numpy as np


def _subpaths(d):
    # vtracer polygon 출력 — "M x y L x y ... Z M ..." 를 점 목록들로
    out = []
    for chunk in re.split(r'(?=M)', d.strip()):
        nums = [float(v) for v in re.findall(r'-?\d+(?:\.\d+)?', chunk)]
        if len(nums) >= 6:
            out.append(np.array(nums, float).reshape(-1, 2))
    return out


def _resample(p, step):
    q = np.vstack([p, p[:1]])
    seg = np.sqrt(((q[1:] - q[:-1]) ** 2).sum(1))
    L = seg.sum()
    if L < step * 6:
        return p
    n = max(8, int(L / step))
    t = np.concatenate([[0], np.cumsum(seg)])
    s = np.linspace(0, L, n, endpoint=False)
    x = np.interp(s, t, q[:, 0]); y = np.interp(s, t, q[:, 1])
    return np.stack([x, y], 1)


def _gauss(p, sig_pts):
    if sig_pts <= 0.3:
        return p
    r = int(np.ceil(sig_pts * 3))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sig_pts) ** 2); k /= k.sum()
    n = len(p)
    if n < 2 * r + 1:
        return p
    pad = np.vstack([p[-r:], p, p[:r]])
    return np.stack([np.convolve(pad[:, i], k, mode='valid') for i in (0, 1)], 1)


def _area(p):
    x, y = p[:, 0], p[:, 1]
    return 0.5 * (x * np.roll(y, -1) - np.roll(x, -1) * y).sum()


def smooth_d(d, sig, step=1.0, fmt=None, min_area=0.0):
    """폴리곤 path d → 매끈한 곡선 path d. sig·step 은 path 좌표 단위다."""
    fmt = fmt or (lambda v: ('%.2f' % v).rstrip('0').rstrip('.'))
    parts = []
    for p in _subpaths(d):
        a0 = abs(_area(p))
        if a0 < min_area:
            continue
        q = _gauss(_resample(p, step), sig / step)
        # 가우시안은 볼록한 모양을 안쪽으로 줄인다 — 넓이를 되돌리도록 무게중심에서 조금 키운다
        a1 = abs(_area(q))
        if a1 > 0:
            c = q.mean(0); q = c + (q - c) * np.sqrt(a0 / a1)
        # 곡선의 마디는 몇 점마다 하나 — 너무 촘촘하면 파일만 커진다
        q = q[::max(1, int(round(2.0 / step)))]
        n = len(q)
        s = 'M%s %s' % (fmt(q[0, 0]), fmt(q[0, 1]))
        for i in range(n):
            p0, p1, p2, p3 = q[i - 1], q[i], q[(i + 1) % n], q[(i + 2) % n]
            c1 = p1 + (p2 - p0) / 6; c2 = p2 - (p3 - p1) / 6
            s += 'C%s %s %s %s %s %s' % tuple(fmt(v) for v in (c1[0], c1[1], c2[0], c2[1], p2[0], p2[1]))
        parts.append(s + 'Z')
    return ''.join(parts)
