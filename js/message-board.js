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
        div.className = 'flex mb-3 ' + (isMe ? 'justify-end' : 'justify-start');
        div.innerHTML = `
            <div class="max-w-[80%]">
                <div class="text-xs text-[#9B8E82] mb-0.5 px-1 ${isMe ? 'text-right' : ''}">
                    ${msg.name} · ${new Date(msg.time).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}
                </div>
                <div class="px-3 py-2 rounded-2xl text-sm ${isMe ? 'bg-[#E6C5A3] text-white rounded-br-md' : 'bg-white text-[#5F5449] rounded-bl-md border border-[#E6C5A3]/30'}">
                    ${msg.text.replace(/</g,'&lt;')}
                </div>
            </div>
        `;
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
