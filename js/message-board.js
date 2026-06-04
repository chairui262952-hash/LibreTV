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
        
        // 确定身份：URL 参数或 localStorage
        const params = new URLSearchParams(window.location.search);
        myName = params.get('me') || localStorage.getItem('msgBoardName') || '';
        if (!myName) {
            myName = prompt('你是谁呀？填个名字吧～', '小柴') || '小可爱';
            localStorage.setItem('msgBoardName', myName);
        }
        
        // 监听消息
        msgRef.limitToLast(50).on('child_added', function(snap) {
            renderMessage(snap.val());
        });

        // 已加载
        document.getElementById('msgBoardLoading')?.classList.add('hidden');
    }

    function renderMessage(msg) {
        const list = document.getElementById('msgList');
        if (!list) return;
        const div = document.createElement('div');
        const isMe = msg.name === myName;
        const timeStr = new Date(msg.time).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
        div.style.cssText = 'display:flex;margin-bottom:0.75rem;' + (isMe ? 'justify-content:flex-end;' : 'justify-content:flex-start;');
        
        // 纸张色系
        const paperColors = ['#FFF9F0','#FFF5F5','#F5FFF5','#FFF8F0','#F8F5FF','#FFFFF5','#FFF0F5'];
        const paperColor = paperColors[Math.floor(Math.random() * paperColors.length)];
        
        div.innerHTML = `
            <div style="max-width:82%;${isMe ? 'text-align:right;' : ''}">
                <div style="font-size:0.7rem;color:#B8A090;margin-bottom:0.2rem;padding:0 0.3rem;">
                    <span style="font-weight:600;">${msg.name}</span> · ${timeStr}
                </div>
                <div style="
                    display:inline-block;
                    background:${paperColor};
                    padding:0.6rem 0.9rem;
                    border-radius:14px;
                    font-size:0.85rem;
                    color:#5F5449;
                    line-height:1.5;
                    box-shadow:0 1px 4px rgba(180,160,140,0.1);
                    ${isMe ? 'border-bottom-right-radius:4px;margin-right:2px;' : 'border-bottom-left-radius:4px;margin-left:2px;'}
                    position:relative;
                ">
                    ${msg.text.replace(/</g,'&lt;')}
                </div>
            </div>
        `;
        list.appendChild(div);
        list.scrollTop = list.scrollHeight;
    }
        list.appendChild(div);
        list.scrollTop = list.scrollHeight;
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

    window.toggleMsgBoard = function(e) {
        const panel = document.getElementById('msgBoardPanel');
        panel?.classList.toggle('show');
        if (e) { e.preventDefault(); e.stopPropagation(); }
    };

    // 回车发送
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && document.activeElement?.id === 'msgInput') {
            sendMessage();
        }
    });

    initFirebase();
})();
