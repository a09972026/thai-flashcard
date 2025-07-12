document.addEventListener('DOMContentLoaded', () => {
    const card = document.getElementById('card');
    const playBtn = document.getElementById('playBtn');
    const resetBtn = document.getElementById('resetBtn');
    const progress = document.getElementById('progress');
    const sentenceSection = document.getElementById('sentenceSection');
    const lockButtons = document.querySelectorAll('.lockBtn');
    const switchLangBtn = document.getElementById('switchLangBtn');

    let language = localStorage.getItem('flashcardLanguage') || 'thai'; // thai or japanese
    let words = [];
    let currentIndex = null;
    let showingMeaning = false;
    const synth = window.speechSynthesis;
    let learnedStatus = JSON.parse(localStorage.getItem('learnedStatus_' + language) || '{}');

    async function loadWordsFromJson() {
        try {
            const fileName = language === 'thai' ? 'words.json' : 'japanese.json';
            const res = await fetch(fileName);
            if (!res.ok) throw new Error('Failed to load word data');
            words = await res.json();
            updateProgress();
            showRandomCard();
        } catch (err) {
            console.error(err);
            alert('Failed to load word data.');
        }
    }

    function speak(text) {
        if (synth.speaking) synth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language === 'thai' ? 'th-TH' : 'ja-JP';
        utterance.rate = 0.6;
        synth.speak(utterance);
    }

    function showRandomCard() {
        const unlockedWords = words.filter(word => {
            const status = learnedStatus[word.thai || word.jp];
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
        let prevWord = words[currentIndex]?.thai || words[currentIndex]?.jp;
        do {
            word = unlockedWords[Math.floor(Math.random() * unlockedWords.length)];
        } while (unlockedWords.length > 1 && ((word.thai || word.jp) === prevWord));

        currentIndex = words.findIndex(w => (w.thai || w.jp) === (word.thai || word.jp));
        card.textContent = word.thai || word.jp;
        showingMeaning = false;
        renderSentences(word);
        speak(word.thai || word.jp);
        updateProgress();
    }

    function renderSentences(word) {
        let html = '';
        const targetWord = word.thai || word.jp;
        const thaiSentences = word.thaiSentences || word.jpSentences || [];
        const cnSentences = word.cnSentences || [];

        thaiSentences.forEach((sent, i) => {
            const cnSent = cnSentences[i] || '';
            const escaped = targetWord.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const highlighted = sent.replace(new RegExp(escaped, 'g'), `<span>${targetWord}</span>`);
            html += `
                <div class="sentence-pair">
                    <p class="thai-sentence" data-text="${sent}">👤 ${highlighted} 🔊</p>
                    <p class="cn-sentence">${cnSent}</p>
                </div>
            `;
        });
        sentenceSection.innerHTML = html;

        document.querySelectorAll('.thai-sentence').forEach(el => {
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => speak(el.getAttribute('data-text')));
        });
    }

    function updateProgress() {
        const total = words.length;
        const learned = Object.values(learnedStatus).filter(s => s.learned && s.skipCount < s.lockCount).length;
        const word = words[currentIndex];
        progress.textContent = word
            ? `Word ${currentIndex + 1} of ${total} | Learned: ${learned}`
            : `No active word`;
    }

    function lockWord(lockCount) {
        if (currentIndex === null) return;
        const wordKey = words[currentIndex].thai || words[currentIndex].jp;
        learnedStatus[wordKey] = {
            learned: true,
            skipCount: 0,
            lockCount: lockCount
        };
        localStorage.setItem('learnedStatus_' + language, JSON.stringify(learnedStatus));
        updateProgress();
        handleNext();
    }

    function handleNext() {
        for (const [key, status] of Object.entries(learnedStatus)) {
            if (status.learned && status.skipCount < status.lockCount) {
                status.skipCount += 1;
            }
        }
        localStorage.setItem('learnedStatus_' + language, JSON.stringify(learnedStatus));
        showRandomCard();
    }

    function resetProgress() {
        if (!confirm("Are you sure you want to reset？")) return;
        if (!confirm("⚠️ All markers will be deleted, are you sure?")) return;
        localStorage.removeItem('learnedStatus_' + language);
        learnedStatus = {};
        updateProgress();
        showRandomCard();
    }

    function switchLanguage() {
        language = language === 'thai' ? 'japanese' : 'thai';
        localStorage.setItem('flashcardLanguage', language);
        learnedStatus = JSON.parse(localStorage.getItem('learnedStatus_' + language) || '{}');
        switchLangBtn.textContent = language === 'thai' ? '🌐 Switch to Japanese' : '🌐 切り替え：ไทย語へ';
        loadWordsFromJson();
    }

    card.addEventListener('click', () => {
        if (!words.length) return;
        const word = words[currentIndex];
        if (showingMeaning) {
            card.textContent = word.thai || word.jp;
            speak(word.thai || word.jp);
        } else {
            card.textContent = word.meaning;
        }
        showingMeaning = !showingMeaning;
    });

    playBtn.addEventListener('click', () => {
        if (!words.length || currentIndex === null) return;
        const word = words[currentIndex];
        speak(word.thai || word.jp);
    });

    resetBtn.addEventListener('click', resetProgress);

    lockButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const count = parseInt(btn.dataset.lock, 10);
            lockWord(count);
        });
    });

    switchLangBtn.addEventListener('click', switchLanguage);

    loadWordsFromJson();
});
