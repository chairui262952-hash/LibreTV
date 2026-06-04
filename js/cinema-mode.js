/**
 * 小笨电视 — 影院模式
 * 按钮扩散黑幕 → 选项面板 → 退出反向动画
 */
(function() {
    const CINEMA_KEY = 'cinemaRoomCode';

    // 创建影院覆盖层
    function createCinemaOverlay(fromEl) {
        // 如果已存在，先移除
        const old = document.getElementById('cinemaOverlay');
        if (old) old.remove();

        const overlay = document.createElement('div');
        overlay.id = 'cinemaOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99990;display:flex;align-items:center;justify-content:center;pointer-events:none;';

        // 扩散圆圈
        const circle = document.createElement('div');
        circle.id = 'cinemaCircle';
        circle.style.cssText = 'position:absolute;border-radius:50%;background:#0a0a0a;pointer-events:none;';

        // 内容面板（初始隐藏）
        const panel = document.createElement('div');
        panel.id = 'cinemaPanel';
        panel.style.cssText = 'position:relative;z-index:1;text-align:center;opacity:0;transform:scale(0.9);';
        panel.innerHTML = `
            <div style="margin-bottom:2rem;">
                <span style="font-size:3rem;">🏰</span>
                <h2 style="font-size:1.8rem;color:#E6C5A3;margin:0.5rem 0;font-weight:bold;">欢迎来到影厅</h2>
                <p style="color:#9B8E82;font-size:0.9rem;">布布和一二陪你一起看 🎬</p>
            </div>
            <!-- 加入房间 -->
            <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(230,197,163,0.2);border-radius:20px;padding:1.2rem;margin-bottom:1rem;">
                <p style="color:#C4B8AC;font-size:0.85rem;margin-bottom:0.8rem;">🔗 加入TA的影厅</p>
                <div style="display:flex;gap:0.5rem;justify-content:center;">
                    <input id="cinemaJoinInput" type="text" placeholder="房间号" maxlength="6" autocomplete="off"
                           style="width:100px;background:rgba(255,255,255,0.08);border:1px solid rgba(230,197,163,0.3);border-radius:14px;padding:0.6rem 1rem;color:#E6C5A3;font-size:1.1rem;text-align:center;outline:none;letter-spacing:0.3em;">
                    <button onclick="cinemaJoin()" style="background:#E6C5A3;color:#FFF;border:none;border-radius:14px;padding:0.6rem 1.2rem;font-size:0.95rem;font-weight:bold;cursor:pointer;">加入</button>
                </div>
            </div>
            <!-- 新建房间 -->
            <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(230,197,163,0.2);border-radius:20px;padding:1.2rem;margin-bottom:1.5rem;">
                <p style="color:#C4B8AC;font-size:0.85rem;margin-bottom:0.8rem;">🏠 创建自己的影厅</p>
                <div style="display:flex;gap:0.5rem;justify-content:center;">
                    <input id="cinemaNewInput" type="text" placeholder="自定义房间号" maxlength="6" autocomplete="off"
                           style="width:100px;background:rgba(255,255,255,0.08);border:1px solid rgba(230,197,163,0.3);border-radius:14px;padding:0.6rem 1rem;color:#E6C5A3;font-size:1.1rem;text-align:center;outline:none;letter-spacing:0.3em;">
                    <button onclick="cinemaCreate()" style="background:rgba(230,197,163,0.3);color:#E6C5A3;border:1px solid rgba(230,197,163,0.3);border-radius:14px;padding:0.6rem 1.2rem;font-size:0.95rem;cursor:pointer;">创建</button>
                </div>
            </div>
            <button onclick="cinemaExit()" style="background:transparent;color:#9B8E82;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:0.5rem 2rem;font-size:0.9rem;cursor:pointer;">✕ 离开影厅</button>
        `;

        overlay.appendChild(circle);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        return { overlay, circle, panel };
    }

    // 入场动画：从按钮扩散
    window.openCinema = function(btn) {
        const { overlay, circle, panel } = createCinemaOverlay(btn);

        // 计算按钮中心位置
        const rect = btn.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        // 需要的半径：覆盖整个屏幕
        const maxRadius = Math.sqrt(
            Math.max(cx, window.innerWidth - cx) ** 2 + 
            Math.max(cy, window.innerHeight - cy) ** 2
        );

        circle.style.left = cx + 'px';
        circle.style.top = cy + 'px';
        circle.style.width = '0px';
        circle.style.height = '0px';
        circle.style.transform = 'translate(-50%,-50%)';

        if (typeof anime !== 'undefined') {
            overlay.style.pointerEvents = 'auto';
            // 圆圈扩散
            anime({
                targets: circle,
                width: maxRadius * 2,
                height: maxRadius * 2,
                duration: 800,
                easing: 'easeInOutQuad',
                complete: function() {
                    // 显示面板
                    anime({
                        targets: panel,
                        opacity: [0, 1],
                        scale: [0.9, 1],
                        duration: 400,
                        easing: 'easeOutQuad'
                    });
                }
            });
        } else {
            // fallback
            overlay.style.pointerEvents = 'auto';
            circle.style.transition = 'all 0.8s ease-in-out';
            setTimeout(() => {
                circle.style.width = maxRadius * 2 + 'px';
                circle.style.height = maxRadius * 2 + 'px';
            }, 50);
            setTimeout(() => {
                panel.style.transition = 'all 0.4s ease-out';
                panel.style.opacity = '1';
                panel.style.transform = 'scale(1)';
            }, 800);
        }
    };

    // 退场动画：收缩回按钮
    window.cinemaExit = function(btn) {
        const overlay = document.getElementById('cinemaOverlay');
        const circle = document.getElementById('cinemaCircle');
        const panel = document.getElementById('cinemaPanel');
        if (!overlay) return;

        // 先隐藏面板
        if (typeof anime !== 'undefined') {
            anime({
                targets: panel,
                opacity: [1, 0],
                scale: [1, 0.9],
                duration: 300,
                easing: 'easeInQuad',
                complete: function() {
                    // 圆圈收缩
                    anime({
                        targets: circle,
                        width: 0,
                        height: 0,
                        duration: 600,
                        easing: 'easeInOutQuad',
                        complete: function() {
                            overlay.remove();
                        }
                    });
                }
            });
        } else {
            panel.style.opacity = '0';
            panel.style.transform = 'scale(0.9)';
            setTimeout(() => {
                circle.style.transition = 'all 0.6s ease-in-out';
                circle.style.width = '0px';
                circle.style.height = '0px';
                setTimeout(() => overlay.remove(), 600);
            }, 300);
        }
    };

    // 加入房间
    window.cinemaJoin = function() {
        const code = document.getElementById('cinemaJoinInput')?.value.trim();
        if (!code || code.length < 3) {
            alert('请输入房间号～');
            return;
        }
        // 触发 watch-together 的加入逻辑
        if (typeof window.joinWatchTogether === 'function') {
            document.getElementById('cinemaOverlay')?.remove();
            window.joinWatchTogether(code);
            if (typeof window.lockGuestControls === 'function') window.lockGuestControls();
        } else if (typeof window.joinCinema === 'function') {
            document.getElementById('homeRoomInput').value = code;
            window.joinCinema();
        } else {
            // 跳转
            window.location.href = window.location.origin + '/watch.html?room=' + code;
        }
    };

    // 创建房间
    window.cinemaCreate = function() {
        let code = document.getElementById('cinemaNewInput')?.value.trim();
        if (!code || code.length < 3) {
            code = Math.floor(100000 + Math.random() * 900000).toString();
        }
        localStorage.setItem(CINEMA_KEY, code);
        document.getElementById('cinemaOverlay')?.remove();
        
        if (typeof window.startWatchTogether === 'function') {
            window.startWatchTogether(code);
        } else {
            alert('🎬 影厅已创建！房间号：' + code + '\n\n去播放页点"进入影厅"，让TA输入这个房间号加入');
        }
    };

    // 暴露给外部
    window.cinemaMode = { open: window.openCinema, exit: window.cinemaExit };

})();
