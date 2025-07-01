document.addEventListener('DOMContentLoaded', () => {
    const card = document.getElementById('card');
    const playBtn = document.getElementById('playBtn');
    const resetBtn = document.getElementById('resetBtn');
    const progress = document.getElementById('progress');
    const sentenceSection = document.getElementById('sentenceSection');
    const lockButtons = document.querySelectorAll('.lockBtn');

    let words = [];
    let currentIndex = null;
    let showingMeaning = false;
    const synth = window.speechSynthesis;
    let learnedStatus = JSON.parse(localStorage.getItem('learnedStatus') || '{}');

    async function loadWordsFromJson() {
        try {
            const res = await fetch('words.json');
            if (!res.ok) throw new Error('Failed to load words.json');
            words = await res.json();
            updateProgress();
            showRandomCard();
        } catch (err) {
            console.error(err);
            alert('Failed to load word data.');
        }
    }

    function speakThai(text) {
        if (synth.speaking) synth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'th-TH';
        utterance.rate = 0.6;
        synth.speak(utterance);
    }

    function showRandomCard() {
        // 過濾已鎖定且未達解除條件的單字
        const unlockedWords = words.filter(word => {
            const status = learnedStatus[word.thai];
            return !status?.learned || (status.skipCount >= status.lockCount);
        });

        if (unlockedWords.length === 0) {
            card.textContent = '🎉 All words locked';
            sentenceSection.innerHTML = '';
            currentIndex = null;
            updateProgress();
            return;
        }

        let word;
        let prevWord = words[currentIndex]?.thai;
        do {
            word = unlockedWords[Math.floor(Math.random() * unlockedWords.length)];
        } while (unlockedWords.length > 1 && word.thai === prevWord);

        currentIndex = words.findIndex(w => w.thai === word.thai);
        card.textContent = word.thai;
        showingMeaning = false;
        renderSentences(word);
        speakThai(word.thai);
        updateProgress();
    }

    function renderSentences(word) {
        let html = '';
        const targetWord = word.thai;
        word.thaiSentences.forEach((thaiSent, i) => {
            const cnSent = word.cnSentences[i] || '';
            const escaped = targetWord.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const highlighted = thaiSent.replace(new RegExp(escaped, 'g'), `<span>${targetWord}</span>`);
            html += `
                <div class="sentence-pair">
                    <p class="thai-sentence" data-text="${thaiSent}">👤 ${highlighted} 🔊</p>
                    <p class="cn-sentence">${cnSent}</p>
                </div>
            `;
        });
        sentenceSection.innerHTML = html;

        document.querySelectorAll('.thai-sentence').forEach(el => {
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => speakThai(el.getAttribute('data-text')));
        });
    }

    function updateProgress() {
        const total = words.length;
        // 已學且尚未完成 skipCount 的數量
        const learned = Object.values(learnedStatus).filter(s => s.learned && s.skipCount < s.lockCount).length;
        const word = words[currentIndex];
        progress.textContent = word
            ? `Word ${currentIndex + 1} of ${total} | Learned: ${learned}`
            : `No active word`;
    }

    function lockWord(lockCount) {
        if (currentIndex === null) return;
        const word = words[currentIndex];
        learnedStatus[word.thai] = {
            learned: true,
            skipCount: 0,
            lockCount: lockCount
        };
        localStorage.setItem('learnedStatus', JSON.stringify(learnedStatus));
        updateProgress();
        handleNext();
    }

    function handleNext() {
        // 所有被標記 learned 且尚未完成 skip 的，skipCount +1
        for (const [key, status] of Object.entries(learnedStatus)) {
            if (status.learned && status.skipCount < status.lockCount) {
                status.skipCount += 1;
            }
        }
        localStorage.setItem('learnedStatus', JSON.stringify(learnedStatus));
        showRandomCard();
    }

    function resetProgress() {
        if (!confirm("Are you sure you want to reset？")) return;
        if (!confirm("⚠️ All markers will be deleted, are you sure?")) return;
        localStorage.removeItem('learnedStatus');
        learnedStatus = {};
        updateProgress();
        showRandomCard();
    }

    card.addEventListener('click', () => {
        if (!words.length) return;
        const word = words[currentIndex];
        if (showingMeaning) {
            card.textContent = word.thai;
            speakThai(word.thai);
        } else {
            card.textContent = word.meaning;
        }
        showingMeaning = !showingMeaning;
    });

    playBtn.addEventListener('click', () => {
        if (!words.length || currentIndex === null) return;
        speakThai(words[currentIndex].thai);
    });

    resetBtn.addEventListener('click', resetProgress);

    lockButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const count = parseInt(btn.dataset.lock, 10);
            lockWord(count);
        });
    });

    loadWordsFromJson();
});
