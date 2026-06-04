/**
 * 小笨电视 — 留言板
 * Firebase 实时同步
 */
(function() {
    const firebaseConfig = {
        apiKey: "AIzaSyDucrfUBjACFOl19wn_hn_37LVG13f6AL4",
        authDomain: "xiaobentv.firebaseapp.com",
        databaseURL: "https://xiaobentv-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "xiaobentv",
        storageBucket: "xiaobentv.firebasestorage.app",
        messagingSenderId: "298721128650",
        appId: "1:298721128650:web:72edaeebe6c02e450fc433"
    };

    let db, msgRef, myName = '';

    function initFirebase() {
        if (typeof firebase === 'undefined') {
            setTimeout(initFirebase, 300);
            return;
        }
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.database();
        msgRef = db.ref('messages');
        
        const params = new URLSearchParams(window.location.search);
        myName = params.get('me') || localStorage.getItem('msgBoardName') || '';
        if (!myName) {
            myName = prompt('你是谁呀？填个名字吧～', '小柴') || '小可爱';
            localStorage.setItem('msgBoardName', myName);
        }
        
        msgRef.limitToLast(50).on('child_added', function(snap) {
            renderMessage(snap.val());
        });

        document.getElementById('msgBoardLoading')?.classList.add('hidden');
    }

    function renderMessage(msg) {
        const list = document.getElementById('msgList');
        if (!list) return;
        
        // 隐藏空状态
        const loading = document.getElementById('msgBoardLoading');
        if (loading) loading.style.display = 'none';

        const div = document.createElement('div');
        const timeStr = new Date(msg.time).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
        
        // 随机便签纸颜色 + 随机微旋转
        const colors = ['#FFF9F0','#FFF5F5','#F5FFF5','#FFF8F0','#F8F5FF','#FFFFF5','#FFF0F5','#FFF5F0','#F0FFF5'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const rotate = (Math.random() - 0.5) * 4; // -2° ~ 2°
        
        div.style.cssText = `
            background:${color};
            padding:0.5rem 0.8rem;
            border-radius:14px;
            font-size:0.8rem;
            color:#5F5449;
            box-shadow:0 2px 8px rgba(180,160,140,0.12);
            transform:rotate(${rotate}deg);
            display:inline-block;
            max-width:220px;
            word-break:break-word;
            position:relative;
            transition:transform 0.2s;
            cursor:default;
            flex-shrink:0;
        `;
        div.title = `${msg.name} · ${timeStr}`;
        div.innerHTML = `
            <span style="font-size:0.65rem;color:#B8A090;display:block;margin-bottom:0.15rem;font-weight:600;">${msg.name}</span>
            ${msg.text.replace(/</g,'&lt;')}
            <span style="font-size:0.6rem;color:#C4B8AC;display:block;margin-top:0.2rem;">${timeStr}</span>
        `;
        
        div.addEventListener('mouseenter', function() {
            this.style.transform = `rotate(0deg) scale(1.05)`;
            this.style.zIndex = '5';
        });
        div.addEventListener('mouseleave', function() {
            this.style.transform = `rotate(${rotate}deg) scale(1)`;
            this.style.zIndex = '';
        });
        
        list.appendChild(div);
    }

    window.sendMessage = function() {
        const input = document.getElementById('msgInput');
        const text = input.value.trim();
        if (!text || !msgRef) return;
        msgRef.push({
            name: myName,
            text: text,
            time: Date.now()
        });
        input.value = '';
    };

    window.scrollToMsgBoard = function() {
        const wall = document.getElementById('msgWall');
        if (wall) {
            wall.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // 闪烁效果
            wall.style.transition = 'all 0.3s';
            wall.style.boxShadow = '0 0 0 4px rgba(230,197,163,0.4)';
            setTimeout(() => { wall.style.boxShadow = ''; }, 1500);
        }
    };

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && document.activeElement?.id === 'msgInput') {
            sendMessage();
        }
    });

    initFirebase();
})();
