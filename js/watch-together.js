/**
 * 小笨电视 — 一起看功能
 * 房主控制播放，客端自动同步
 */
(function() {
    // Firebase 配置
    const firebaseConfig = {
        apiKey: "AIzaSyDucrfUBjACFOl19wn_hn_37LVG13f6AL4",
        authDomain: "xiaobentv.firebaseapp.com",
        databaseURL: "https://xiaobentv-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "xiaobentv",
        storageBucket: "xiaobentv.firebasestorage.app",
        messagingSenderId: "298721128650",
        appId: "1:298721128650:web:72edaeebe6c02e450fc433"
    };

    // 等待 Firebase SDK 加载
    function waitForFirebase(cb) {
        if (typeof firebase !== 'undefined' && firebase.database) {
            cb();
        } else {
            setTimeout(() => waitForFirebase(cb), 200);
        }
    }

    let app, db, roomRef, stateRef, hostRef;
    let roomCode = null;
    let isHost = false;
    let isGuest = false;
    let syncPaused = false; // 本地操作时暂停远程同步

    // 生成6位房间号
    function generateRoomCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // 初始化 Firebase
    function initFirebase() {
        app = firebase.initializeApp(firebaseConfig);
        db = firebase.database();
    }

    // ========== 房主：创建房间 ==========
    window.startWatchTogether = function() {
        if (typeof firebase === 'undefined') return alert('Firebase 加载中，请稍后再试');
        if (!app) initFirebase();
        
        roomCode = generateRoomCode();
        isHost = true;
        roomRef = db.ref('rooms/' + roomCode);
        stateRef = roomRef.child('state');
        hostRef = roomRef.child('host');

        // 初始化房间
        roomRef.set({
            host: { online: true, lastSeen: firebase.database.ServerValue.TIMESTAMP },
            state: { playing: false, currentTime: 0, timestamp: Date.now() }
        });

        // 房主离开时清理
        window.addEventListener('beforeunload', destroyRoom);
        
        // 定期更新在线状态
        setInterval(() => {
            if (hostRef) hostRef.update({ lastSeen: firebase.database.ServerValue.TIMESTAMP });
        }, 5000);

        // 同步播放状态到 Firebase
        startHostSync();

        // 显示房间号
        showRoomUI(roomCode);
        updateRoomBadge('房主 · 同步中');
    };

    // ========== 客端：加入房间 ==========
    window.joinWatchTogether = function(code) {
        if (typeof firebase === 'undefined') return alert('Firebase 加载中，请稍后再试');
        if (!app) initFirebase();
        
        roomCode = code;
        isGuest = true;
        roomRef = db.ref('rooms/' + code);
        stateRef = roomRef.child('state');
        hostRef = roomRef.child('host');

        // 监听房间状态
        stateRef.on('value', function(snapshot) {
            const state = snapshot.val();
            if (!state || syncPaused) return;
            applyRemoteState(state);
        });

        // 监听房主在线状态
        hostRef.on('value', function(snapshot) {
            const host = snapshot.val();
            if (!host || !host.online) {
                updateRoomBadge('💔 房主离开了');
            } else {
                updateRoomBadge('💕 跟房主同步中');
            }
        });

        showRoomUI(code);
        updateRoomBadge('💕 跟房主同步中');
    };

    // 房主：监听本地播放器并同步
    function startHostSync() {
        const art = window.art;
        if (!art) return setTimeout(startHostSync, 500);

        let lastTime = 0;
        art.on('video:playing', function() {
            if (syncPaused) return;
            stateRef.update({ playing: true, currentTime: art.currentTime, timestamp: Date.now() });
        });
        art.on('video:pause', function() {
            if (syncPaused) return;
            stateRef.update({ playing: false, currentTime: art.currentTime, timestamp: Date.now() });
        });
        art.on('video:seeked', function() {
            if (syncPaused) return;
            stateRef.update({ playing: !art.video.paused, currentTime: art.currentTime, timestamp: Date.now() });
        });
        // 定期同步时间
        setInterval(() => {
            if (art && art.video && !art.video.paused && !syncPaused) {
                const now = art.currentTime;
                if (Math.abs(now - lastTime) > 1) {
                    lastTime = now;
                    stateRef.update({ playing: true, currentTime: now, timestamp: Date.now() });
                }
            }
        }, 2000);
    }

    // 客端：应用远程播放状态
    function applyRemoteState(state) {
        const art = window.art;
        if (!art || !art.video) return;

        const localTime = art.currentTime;
        const remoteTime = state.currentTime;
        const diff = Math.abs(localTime - remoteTime);

        // 时间差超过2秒才同步
        if (diff > 2) {
            syncPaused = true;
            art.currentTime = remoteTime;
            setTimeout(() => { syncPaused = false; }, 500);
        }

        // 同步播放/暂停
        if (state.playing && art.video.paused) {
            art.play();
        } else if (!state.playing && !art.video.paused) {
            art.pause();
        }
    }

    // 销毁房间
    function destroyRoom() {
        if (roomRef && isHost) {
            roomRef.remove();
        }
        if (stateRef && isGuest) {
            stateRef.off();
            hostRef.off();
        }
    }

    // ========== UI ==========
    function showRoomUI(code) {
        const badge = document.getElementById('watchTogetherBadge');
        const codeEl = document.getElementById('roomCode');
        if (badge) badge.classList.remove('hidden');
        if (codeEl) codeEl.textContent = code;
    }

    function updateRoomBadge(text) {
        const status = document.getElementById('syncStatus');
        if (status) status.textContent = text;
    }

    // 复制房间链接
    window.copyRoomLink = function() {
        const url = new URL(window.location.href);
        url.searchParams.set('room', roomCode);
        navigator.clipboard.writeText(url.toString()).then(() => {
            const toast = document.getElementById('toast');
            const msg = document.getElementById('toastMessage');
            if (toast && msg) {
                msg.textContent = '💕 链接已复制！发给女朋友吧';
                toast.classList.remove('hidden');
                toast.style.opacity = '1';
                setTimeout(() => { toast.style.opacity = '0'; }, 2500);
            }
        });
    };

    // 客端锁定播放器控件
    function lockGuestControls() {
        if (!isGuest) return;
        const style = document.createElement('style');
        style.id = 'guestLock';
        style.textContent = `
            .dplayer-controller, .dplayer-bar-wrap, .dplayer-mask {
                opacity: 0.5 !important;
                pointer-events: none !important;
            }
            #watchTogetherBadge { display: flex !important; }
        `;
        document.head.appendChild(style);
    }

    // 页面加载时检查是否有 room 参数
    waitForFirebase(function() {
        if (!app) initFirebase();
        const params = new URLSearchParams(window.location.search);
        const room = params.get('room');
        if (room) {
            // 有 room 参数 = 客端加入
            setTimeout(() => {
                window.joinWatchTogether(room);
                lockGuestControls();
            }, 1500);
        }
    });

})();
