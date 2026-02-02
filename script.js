const BlueOS = {
  zIndex: 100,
  activeWindows: 0,
  recognition: null,
  synth: window.speechSynthesis,
  voices: [],
  selectedVoiceURI: null,
  isListening: false,
  dragCounter: 0,
  db: null,

  // ========== JOKES & QUOTES ==========
  jokes: [
    "Why do programmers prefer dark mode? Because light attracts bugs!",
    "I told my computer I needed a break... now it won't stop sending me travel ads.",
    "Why was the JavaScript developer sad? Because he didn't Node how to Express himself!",
    "There are only 10 types of people in the world: those who understand binary and those who don't.",
    "Why do Java developers wear glasses? Because they can't C#!",
    "A SQL query walks into a bar, walks up to two tables and asks... 'Can I join you?'",
    "What's a computer's favorite snack? Microchips!",
    "Why did the developer go broke? Because he used up all his cache!"
  ],

  quotes: [
    "The only way to do great work is to love what you do. - Steve Jobs",
    "Innovation distinguishes between a leader and a follower. - Steve Jobs",
    "Stay hungry, stay foolish. - Steve Jobs",
    "The future belongs to those who believe in the beauty of their dreams. - Eleanor Roosevelt",
    "Code is like humor. When you have to explain it, it's bad. - Cory House",
    "First, solve the problem. Then, write the code. - John Johnson"
  ],

  init() {
    this.initDB();
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);
    this.setupDragDrop();
    this.initVoiceRecognition();
    this.loadVoicePreference();

    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => {
        this.voices = this.synth.getVoices();
        this.loadVoicePreference();
      };
    }

    // Force load voices on mobile
    setTimeout(() => {
      if (this.voices.length === 0) this.voices = this.synth.getVoices();
    }, 500);

    setTimeout(() => {
      this.speak("Blue initialized. Welcome back. Tap the orb or say a command to begin.");
    }, 1200);

    document.getElementById("ai-orb-container").addEventListener("click", () => {
      if (this.isListening) {
        try { this.recognition.stop(); } catch (e) { }
      } else {
        this.startListening();
      }
    });

    // Touch support for orb
    document.getElementById("ai-orb-container").addEventListener("touchend", (e) => {
      e.preventDefault();
      if (this.isListening) {
        try { this.recognition.stop(); } catch (e) { }
      } else {
        this.startListening();
      }
    });
  },

  // ========== VOICE PREFERENCE ==========
  loadVoicePreference() {
    const saved = localStorage.getItem("blueos-voice");
    if (saved && this.voices.length > 0) {
      const found = this.voices.find(v => v.voiceURI === saved);
      if (found) this.selectedVoiceURI = saved;
    }
  },

  setVoice(voiceURI) {
    this.selectedVoiceURI = voiceURI;
    localStorage.setItem("blueos-voice", voiceURI);
    this.speak("Voice changed successfully.");
  },

  getPreferredVoice() {
    if (this.selectedVoiceURI) {
      const v = this.voices.find(v => v.voiceURI === this.selectedVoiceURI);
      if (v) return v;
    }
    // Fallback priorities
    const priorities = ["Samantha", "Google US English", "Microsoft Zira", "Google UK English Female"];
    for (const name of priorities) {
      const found = this.voices.find(v => v.name.includes(name));
      if (found) return found;
    }
    return this.voices[0];
  },

  // ========== HIGH CAPACITY STORAGE (IndexedDB) ==========
  initDB() {
    const request = indexedDB.open("BlueOS_HighCap_DB", 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("media")) {
        db.createObjectStore("media", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("sys_config")) {
        db.createObjectStore("sys_config", { keyPath: "key" });
      }
    };
    request.onsuccess = (e) => {
      this.db = e.target.result;
      this.loadWallpaper();
    };
    request.onerror = (e) => console.error("DB Error:", e);
  },

  saveMediaToDB(fileData, callback) {
    if (!this.db) return;
    const tx = this.db.transaction(["media"], "readwrite");
    const store = tx.objectStore("media");
    const req = store.put(fileData);
    req.onsuccess = () => { if (callback) callback(true); };
    req.onerror = () => {
      alert("Storage Error: File might be too massive.");
      if (callback) callback(false);
    };
  },

  deleteMediaFromDB(id, callback) {
    const tx = this.db.transaction(["media"], "readwrite");
    tx.objectStore("media").delete(id);
    tx.oncomplete = () => { if (callback) callback(); };
  },

  saveWallpaperPref(currentWall) {
    const tx = this.db.transaction(["sys_config"], "readwrite");
    tx.objectStore("sys_config").put({ key: "wallpaper", value: currentWall });
  },

  // ========== VOICE RECOGNITION ==========
  initVoiceRecognition() {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = "en-US";

      this.recognition.onstart = () => {
        this.isListening = true;
        document.getElementById("orb-text").textContent = "LISTENING...";
        document.querySelector(".orb-core").style.boxShadow = "0 0 60px #ff00ff, 0 0 120px #ff00ff";
      };

      this.recognition.onresult = (event) => {
        const command = event.results[0][0].transcript.toLowerCase();
        document.getElementById("orb-text").textContent = command.toUpperCase();
        setTimeout(() => this.processCommand(command), 500);
      };

      this.recognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        document.getElementById("orb-text").textContent = "STATUS: READY";
        this.isListening = false;
        document.querySelector(".orb-core").style.boxShadow = "0 0 40px var(--neon), 0 0 80px var(--neon)";
      };

      this.recognition.onend = () => {
        this.isListening = false;
        document.querySelector(".orb-core").style.boxShadow = "0 0 40px var(--neon), 0 0 80px var(--neon)";
        setTimeout(() => {
          if (!this.isListening && document.getElementById("orb-text").textContent === "LISTENING...") {
            document.getElementById("orb-text").textContent = "BLUE OS READY";
          }
        }, 2000);
      };
    }
    this.voices = this.synth.getVoices();
  },

  startListening() {
    if (!this.recognition) {
      this.speak("Voice recognition is not supported in your browser.");
      return;
    }
    if (this.isListening) return;
    try {
      this.recognition.start();
    } catch (e) {
      console.error("Recognition start error:", e);
      this.isListening = false;
    }
  },

  speak(text) {
    if (!this.synth) return;
    if (this.voices.length === 0) this.voices = this.synth.getVoices();
    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = this.getPreferredVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    document.getElementById("orb-text").textContent = text.toUpperCase();
    this.synth.speak(utterance);
  },

  // ========== COMMAND PROCESSING (EXPANDED) ==========
  processCommand(cmd) {
    // Apps
    if (cmd.includes("open google") || cmd.includes("open search") || cmd.includes("open browser")) {
      this.openApp("browser");
      this.speak("Opening Google Search");
    } else if (cmd.includes("open terminal")) {
      this.openApp("terminal");
      this.speak("Opening Terminal");
    } else if (cmd.includes("open youtube")) {
      window.open("https://www.youtube.com/", "_blank");
      this.speak("Opening YouTube");
    } else if (cmd.includes("open notes") || cmd.includes("open notepad")) {
      this.openApp("notepad");
      this.speak("Opening Notepad");
    } else if (cmd.includes("open calculator")) {
      this.openApp("calculator");
      this.speak("Opening Calculator");
    } else if (cmd.includes("open photos") || cmd.includes("open gallery") || cmd.includes("open photo")) {
      this.openApp("photos");
      this.speak("Opening Photos");
    } else if (cmd.includes("open app studio") || cmd.includes("app studio")) {
      this.openApp("appstudio");
      this.speak("Opening App Studio");
    } else if (cmd.includes("open settings")) {
      this.openApp("settings");
      this.speak("Opening Settings");
    } else if (cmd.includes("open camera")) {
      this.openApp("camera");
      this.speak("Opening Camera");
    } else if (cmd.includes("open help") || cmd.includes("what can you do") || cmd.includes("help me")) {
      this.openApp("help");
      this.speak("Here's what I can do");
    }
    // Wallpaper
    else if (cmd.includes("change wallpaper") || cmd.includes("wallpaper")) {
      this.openWallpaperPicker();
      this.speak("Opening wallpaper picker");
    }
    // Close windows
    else if (cmd.includes("close all") || cmd.includes("close windows")) {
      document.querySelectorAll(".win-frame").forEach((w) => this.close(w.id));
      this.speak("All windows closed");
    }
    // Time & Date
    else if (cmd.includes("what time") || cmd.includes("the time")) {
      const time = new Date().toLocaleTimeString();
      this.speak(`The current time is ${time}`);
    } else if (cmd.includes("what date") || cmd.includes("the date") || cmd.includes("what day")) {
      const date = new Date().toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      this.speak(`Today is ${date}`);
    }
    // Conversational
    else if (cmd.includes("tell me a joke") || cmd.includes("joke")) {
      const joke = this.jokes[Math.floor(Math.random() * this.jokes.length)];
      this.speak(joke);
    } else if (cmd.includes("motivate me") || cmd.includes("inspire me") || cmd.includes("quote")) {
      const quote = this.quotes[Math.floor(Math.random() * this.quotes.length)];
      this.speak(quote);
    } else if (cmd.includes("who are you") || cmd.includes("what are you")) {
      this.speak("I am Blue, your personal AI assistant. I can open apps, search the web, tell jokes, and much more!");
    } else if (cmd.includes("how are you")) {
      this.speak("I'm running at optimal efficiency! How can I assist you today?");
    } else if (cmd.includes("thank you") || cmd.includes("thanks")) {
      this.speak("You're welcome! Happy to help.");
    } else if (cmd.includes("good morning")) {
      this.speak("Good morning! Hope you have a productive day ahead!");
    } else if (cmd.includes("good night")) {
      this.speak("Good night! Rest well and see you soon.");
    } else if (cmd.includes("hello") || cmd.includes("hi blue") || cmd.includes("hey")) {
      this.speak("Hello! How can I help you today?");
    }
    // Search
    else if (cmd.includes("search for")) {
      const query = cmd.replace("search for", "").trim();
      const winID = this.openApp("browser");
      setTimeout(() => {
        const searchInput = document.getElementById(`g-search-${winID}`);
        if (searchInput) {
          searchInput.value = query;
          this.speak(`Searching for ${query}`);
          this.handleSearch(winID);
        }
      }, 800);
    }
    // Shutdown
    else if (cmd.includes("shutdown") || cmd.includes("shut down")) {
      this.shutdown();
    }
    // Default
    else {
      this.speak(`I heard: ${cmd}. Try saying "help" to see what I can do.`);
    }
  },

  updateClock() {
    const now = new Date();
    const clock = document.getElementById("sys-clock");
    if (clock) {
      clock.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  },

  // ========== APP OPENING ==========
  openApp(type) {
    this.zIndex++;
    this.activeWindows++;
    this.AI.dock();

    const winID = `win-${Date.now()}`;
    const win = document.createElement("div");
    win.classList.add("win-frame", "active");
    win.id = winID;
    win.style.zIndex = this.zIndex;

    let width = "500px";
    let height = "400px";

    if (type === "browser") { width = "60vw"; height = "60vh"; }
    else if (type === "appstudio") { width = "600px"; height = "550px"; }
    else if (type === "photos") { width = "700px"; height = "500px"; }
    else if (type === "settings") { width = "550px"; height = "500px"; }
    else if (type === "help") { width = "650px"; height = "480px"; }
    else if (type === "camera") { width = "500px"; height = "420px"; }

    win.style.width = width;
    win.style.height = height;
    win.style.top = type === "browser" ? "20vh" : "calc(50% - 200px)";
    win.style.left = type === "browser" ? "20vw" : "calc(50% - 250px)";

    const content = this.getAppContent(type, winID);

    win.innerHTML = `
      <div class="win-head" id="head-${winID}">
        <div class="win-title"><i class="${content.icon}"></i> ${content.title}</div>
        <div class="win-controls">
          <button class="ctrl-btn ctrl-min" onclick="BlueOS.minimize('${winID}')"></button>
          <button class="ctrl-btn ctrl-max" onclick="BlueOS.maximize('${winID}')"></button>
          <button class="ctrl-btn ctrl-close" onclick="BlueOS.close('${winID}')"></button>
        </div>
      </div>
      <div class="win-body">${content.html}</div>
    `;

    document.body.appendChild(win);
    this.makeDraggable(winID);
    this.focusWindow(winID);

    win.addEventListener("mousedown", () => this.focusWindow(winID));
    win.addEventListener("touchstart", () => this.focusWindow(winID), { passive: true });

    if (type === "browser") {
      setTimeout(() => {
        const input = document.getElementById(`g-search-${winID}`);
        if (input) input.focus();
      }, 100);
    }

    if (type === "photos") {
      this.loadPhotosGallery(winID);
    }

    if (type === "settings") {
      this.populateVoiceDropdown(winID);
    }

    if (type === "camera") {
      this.initCamera(winID);
    }

    return winID;
  },

  getAppContent(type, id) {
    switch (type) {
      case "browser":
        return {
          title: "Google Search",
          icon: "fab fa-google",
          html: `
            <div class="search-ui">
              <div class="google-logo">Google</div>
              <input type="text" class="search-input" id="g-search-${id}" 
                placeholder="Search Google or type a URL..." 
                onkeypress="if(event.key==='Enter'){BlueOS.handleSearch('${id}')}">
            </div>
          `,
        };
      case "notepad":
        const savedNote = localStorage.getItem("blueos-notes") || "";
        return {
          title: "Notepad",
          icon: "fas fa-file-alt",
          html: `
            <div class="notepad-toolbar">
              <button class="toolbar-btn" onclick="BlueOS.saveNote('${id}')">
                <i class="fas fa-save"></i> Save
              </button>
              <button class="toolbar-btn" onclick="BlueOS.downloadNote('${id}')">
                <i class="fas fa-download"></i> Download
              </button>
            </div>
            <textarea id="note-${id}" class="notepad-area" 
              placeholder="Start typing..." 
              oninput="localStorage.setItem('blueos-notes', this.value)">${savedNote}</textarea>
          `,
        };
      case "terminal":
        return {
          title: "Terminal",
          icon: "fas fa-terminal",
          html: `
            <div style="padding:20px; color:#0f0; font-family:'JetBrains Mono'; font-size:0.9rem; background:#000; height: 100%;">
              <span style="color:#00f3ff">user@blue-os</span>:<span style="color:#fff">~</span>$ system status<br>
              <span style="color:#0f0">✓ System: ONLINE</span><br>
              <span style="color:#0f0">✓ AI Core: ACTIVE</span><br>
              <span style="color:#0f0">✓ Storage: HIGH CAPACITY (IndexedDB)</span><br>
              <span style="color:#0f0">✓ Touch: ENABLED</span><br>
              <span style="color:#00f3ff">user@blue-os</span>:<span style="color:#fff">~</span>$ <span class="blink">_</span>
            </div>
          `,
        };
      case "calculator":
        return {
          title: "Calculator",
          icon: "fas fa-calculator",
          html: `<iframe src="https://www.desmos.com/scientific" style="width:100%; height:100%; border:none; pointer-events:auto;" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>`,
        };
      case "settings":
        return {
          title: "Settings",
          icon: "fas fa-cog",
          html: `
            <div style="padding: 20px; overflow-y: auto; height: 100%;">
              <h3 style="margin-bottom: 20px; color: var(--neon);">⚙️ BLUE OS Settings</h3>
              
              <div style="margin-bottom: 25px;">
                <p style="margin-bottom: 10px; font-weight: 600; color: #fff;">🎤 Voice Selection</p>
                <select id="voice-select-${id}" class="voice-select" onchange="BlueOS.setVoice(this.value)">
                  <option value="">Loading voices...</option>
                </select>
                <button class="toolbar-btn" onclick="BlueOS.testVoice()" style="width: 100%;">
                  <i class="fas fa-volume-up"></i> Test Voice
                </button>
              </div>

              <div style="margin-bottom: 20px;">
                <p style="margin-bottom: 10px; font-weight: 600; color: #fff;">📋 Voice Commands:</p>
                <ul style="list-style: none; padding-left: 10px; line-height: 1.8; font-size: 0.9rem; color: #ccc;">
                  <li>• "Open Google" - Opens browser</li>
                  <li>• "Open Camera" - Opens camera</li>
                  <li>• "Tell me a joke" - Tells a joke</li>
                  <li>• "What's the time/date" - Time/Date</li>
                  <li>• "Help" - Shows all commands</li>
                </ul>
              </div>

              <div style="padding: 15px; background: rgba(0,243,255,0.1); border-radius: 8px;">
                <p style="font-size: 0.85rem; opacity: 0.8;">
                  <strong>Version:</strong> Blue OS 1.3.1<br>
                  <strong>Touch:</strong> Enabled<br>
                  <strong>Storage:</strong> IndexedDB
                </p>
              </div>
            </div>
          `,
        };
      case "photos":
        return {
          title: "Photos",
          icon: "fas fa-images",
          html: `
            <div style="padding: 20px; height: 100%; display: flex; flex-direction: column;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="color: var(--neon);">📷 Gallery</h3>
                <button class="toolbar-btn" onclick="document.getElementById('photoUpload-${id}').click()">
                  <i class="fas fa-upload"></i> Upload
                </button>
              </div>
              <input type="file" id="photoUpload-${id}" accept="image/*,video/*" style="display: none;" onchange="BlueOS.uploadPhoto(event)">
              <div id="gallery-container-${id}" style="overflow-y: auto; flex: 1;">
                <p style="color: #888;">Loading media...</p>
              </div>
            </div>
          `,
        };
      case "camera":
        return {
          title: "Camera",
          icon: "fas fa-camera",
          html: `
            <div style="display: flex; flex-direction: column; height: 100%; background: #000;">
              <video id="camera-feed-${id}" autoplay playsinline style="flex: 1; object-fit: cover; border-radius: 8px 8px 0 0;"></video>
              <div style="display: flex; gap: 10px; padding: 15px; justify-content: center; background: rgba(0,0,0,0.8);">
                <button class="toolbar-btn" onclick="BlueOS.capturePhoto('${id}')" style="padding: 12px 25px;">
                  <i class="fas fa-camera"></i> Capture
                </button>
                <button class="toolbar-btn" onclick="BlueOS.switchCamera('${id}')" style="padding: 12px 25px;">
                  <i class="fas fa-sync"></i> Switch
                </button>
              </div>
              <canvas id="camera-canvas-${id}" style="display: none;"></canvas>
            </div>
          `,
        };
      case "help":
        return {
          title: "Help & Commands",
          icon: "fas fa-question-circle",
          html: `
            <div style="padding: 20px; overflow-y: auto; height: 100%;">
              <h3 style="margin-bottom: 20px; color: var(--neon);">🤖 Blue Assistant Commands</h3>
              <div class="help-grid">
                <div class="help-item"><strong>Open Apps</strong>"Open Google", "Open Notepad", "Open Camera", "Open Calculator"</div>
                <div class="help-item"><strong>Search</strong>"Search for [query]" - Opens Google search</div>
                <div class="help-item"><strong>Time/Date</strong>"What time is it?", "What's the date?"</div>
                <div class="help-item"><strong>Entertainment</strong>"Tell me a joke", "Motivate me"</div>
                <div class="help-item"><strong>Conversation</strong>"Hello", "How are you?", "Who are you?"</div>
                <div class="help-item"><strong>System</strong>"Close all windows", "Shutdown", "Change wallpaper"</div>
              </div>
              <p style="margin-top: 20px; font-size: 0.85rem; opacity: 0.7;">Tap the orb to start voice command, or use touch to interact with windows.</p>
            </div>
          `,
        };
      case "appstudio":
        const customApps = JSON.parse(localStorage.getItem("blueos-custom-apps") || "[]");
        let appsListHTML = "";
        customApps.forEach((app, idx) => {
          appsListHTML += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 10px;">
              <div><i class="${app.icon}"></i> <strong>${app.name}</strong></div>
              <div style="display: flex; gap: 10px;">
                <button class="toolbar-btn" onclick="BlueOS.launchCustomApp(${idx})"><i class="fas fa-play"></i></button>
                <button class="toolbar-btn" onclick="BlueOS.deleteCustomApp(${idx})" style="background: rgba(255,0,0,0.3);"><i class="fas fa-trash"></i></button>
              </div>
            </div>`;
        });
        return {
          title: "App Studio",
          icon: "fas fa-code",
          html: `
            <div style="padding: 20px; height: 100%; display: flex; flex-direction: column;">
              <h3 style="margin-bottom: 20px; color: var(--neon);">App Studio</h3>
              <div style="margin-bottom: 10px;"><input type="text" id="appName-${id}" placeholder="App Name" style="width: 100%; padding: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 6px;"></div>
              <div style="margin-bottom: 10px;"><input type="text" id="appIcon-${id}" placeholder="Icon Class (fas fa-star)" value="fas fa-rocket" style="width: 100%; padding: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 6px;"></div>
              <textarea id="appHTML-${id}" placeholder="HTML Content..." style="flex: 1; padding: 10px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); color: #0f0; font-family: 'JetBrains Mono'; resize: none; margin-bottom: 10px; border-radius: 6px;"></textarea>
              <button class="toolbar-btn" onclick="BlueOS.saveCustomApp('${id}')" style="width: 100%;"><i class="fas fa-save"></i> Save App</button>
              <div style="margin-top: 15px; overflow-y: auto; max-height: 150px;">${appsListHTML || '<p style="opacity:0.5;">No apps yet.</p>'}</div>
            </div>`,
        };
      default:
        return {
          title: "App",
          icon: "fas fa-window-maximize",
          html: "<p>App</p>",
        };
    }
  },

  // ========== VOICE DROPDOWN ==========
  populateVoiceDropdown(winID) {
    setTimeout(() => {
      const select = document.getElementById(`voice-select-${winID}`);
      if (!select) return;
      if (this.voices.length === 0) this.voices = this.synth.getVoices();

      let html = '';
      this.voices.forEach((v, i) => {
        const selected = (v.voiceURI === this.selectedVoiceURI) ? 'selected' : '';
        const label = `${v.name} (${v.lang})`;
        html += `<option value="${v.voiceURI}" ${selected}>${label}</option>`;
      });
      select.innerHTML = html || '<option>No voices available</option>';
    }, 300);
  },

  testVoice() {
    this.speak("This is how I sound. Do you like this voice?");
  },

  // ========== CAMERA ==========
  currentCameraFacing: 'user',
  cameraStream: null,

  async initCamera(winID) {
    try {
      const constraints = {
        video: { facingMode: this.currentCameraFacing },
        audio: false
      };
      this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      const video = document.getElementById(`camera-feed-${winID}`);
      if (video) video.srcObject = this.cameraStream;
    } catch (err) {
      console.error("Camera error:", err);
      this.speak("Camera access denied or not available.");
    }
  },

  async switchCamera(winID) {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(t => t.stop());
    }
    this.currentCameraFacing = this.currentCameraFacing === 'user' ? 'environment' : 'user';
    await this.initCamera(winID);
  },

  capturePhoto(winID) {
    const video = document.getElementById(`camera-feed-${winID}`);
    const canvas = document.getElementById(`camera-canvas-${winID}`);
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    const dataURL = canvas.toDataURL('image/png');
    const mediaItem = {
      id: Date.now(),
      url: dataURL,
      type: 'image',
      thumbnail: dataURL,
      name: `Photo_${Date.now()}.png`
    };

    this.saveMediaToDB(mediaItem, (success) => {
      if (success) {
        this.speak("Photo captured!");
      }
    });
  },

  handleSearch(id) {
    const input = document.getElementById(`g-search-${id}`);
    if (input && input.value.trim()) {
      this.speak("Opening search results");
      window.open(`https://www.google.com/search?q=${encodeURIComponent(input.value)}`, "_blank");
    }
  },

  saveNote(id) {
    const textarea = document.getElementById(`note-${id}`);
    if (textarea) {
      localStorage.setItem("blueos-notes", textarea.value);
      this.speak("Note saved");
    }
  },

  downloadNote(id) {
    const textarea = document.getElementById(`note-${id}`);
    if (textarea) {
      const blob = new Blob([textarea.value], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "BlueOS_Note.txt";
      a.click();
      URL.revokeObjectURL(url);
      this.speak("Note downloaded");
    }
  },

  // ========== WINDOW CONTROLS (WITH COOL CLOSE) ==========
  close(id) {
    const win = document.getElementById(id);
    if (win) {
      // Stop camera if it's a camera window
      if (this.cameraStream && win.querySelector('[id^="camera-feed"]')) {
        this.cameraStream.getTracks().forEach(t => t.stop());
        this.cameraStream = null;
      }

      win.classList.add("closing");
      setTimeout(() => {
        win.remove();
        this.activeWindows--;
        if (this.activeWindows <= 0) {
          this.activeWindows = 0;
          this.AI.undock();
        }
      }, 400);
    }
  },

  minimize(id) {
    const win = document.getElementById(id);
    if (win) {
      win.style.transform = "scale(0.5) translateY(300px)";
      win.style.opacity = "0";
      setTimeout(() => (win.style.display = "none"), 300);
    }
  },

  maximize(id) {
    const win = document.getElementById(id);
    if (!win) return;
    if (win.getAttribute("data-maximized") === "true") {
      win.style.width = win.getAttribute("data-w");
      win.style.height = win.getAttribute("data-h");
      win.style.top = win.getAttribute("data-t");
      win.style.left = win.getAttribute("data-l");
      win.setAttribute("data-maximized", "false");
    } else {
      win.setAttribute("data-w", win.style.width);
      win.setAttribute("data-h", win.style.height);
      win.setAttribute("data-t", win.style.top);
      win.setAttribute("data-l", win.style.left);
      win.style.width = "100vw";
      win.style.height = "calc(100vh - 85px)";
      win.style.top = "0";
      win.style.left = "0";
      win.setAttribute("data-maximized", "true");
    }
  },

  focusWindow(id) {
    document.querySelectorAll(".win-frame").forEach((w) => w.classList.remove("active"));
    const win = document.getElementById(id);
    if (win) {
      this.zIndex++;
      win.style.zIndex = this.zIndex;
      win.classList.add("active");
    }
  },

  // ========== DRAGGING WITH TOUCH SUPPORT ==========
  makeDraggable(id) {
    const win = document.getElementById(id);
    const header = document.getElementById(`head-${id}`);
    const preview = document.getElementById("snap-preview");
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    const onStart = (e) => {
      if (e.target.closest(".win-controls")) return;
      isDragging = true;

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      startX = clientX;
      startY = clientY;
      startLeft = win.offsetLeft;
      startTop = win.offsetTop;

      win.classList.add("dragging");
      this.focusWindow(id);
      document.querySelectorAll("iframe").forEach((f) => (f.style.pointerEvents = "none"));
    };

    const onMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - startX;
      const deltaY = clientY - startY;
      win.style.left = startLeft + deltaX + "px";
      win.style.top = startTop + deltaY + "px";

      if (win.getAttribute("data-maximized") === "true") {
        win.setAttribute("data-maximized", "false");
        win.style.width = win.getAttribute("data-w") || "500px";
        win.style.height = win.getAttribute("data-h") || "400px";
      }

      const winW = window.innerWidth;
      if (clientX < 30) {
        preview.style.opacity = "1";
        preview.style.left = "0";
        preview.style.top = "0";
        preview.style.width = "50%";
        preview.style.height = "calc(100vh - 85px)";
        win.setAttribute("data-snap", "left");
      } else if (clientX > winW - 30) {
        preview.style.opacity = "1";
        preview.style.left = "50%";
        preview.style.top = "0";
        preview.style.width = "50%";
        preview.style.height = "calc(100vh - 85px)";
        win.setAttribute("data-snap", "right");
      } else {
        preview.style.opacity = "0";
        win.setAttribute("data-snap", "none");
      }
    };

    const onEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      win.classList.remove("dragging");
      preview.style.opacity = "0";
      document.querySelectorAll("iframe").forEach((f) => (f.style.pointerEvents = "auto"));

      const snap = win.getAttribute("data-snap");
      if (snap === "left") {
        win.style.left = "0";
        win.style.top = "0";
        win.style.width = "50%";
        win.style.height = "calc(100vh - 85px)";
      } else if (snap === "right") {
        win.style.left = "50%";
        win.style.top = "0";
        win.style.width = "50%";
        win.style.height = "calc(100vh - 85px)";
      }
    };

    // Mouse events
    header.addEventListener("mousedown", onStart);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);

    // Touch events
    header.addEventListener("touchstart", onStart, { passive: false });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
  },

  // ========== DRAG & DROP FILES ==========
  setupDragDrop() {
    const dropZone = document.getElementById("dropZone");
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      document.body.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });
    document.body.addEventListener("dragenter", () => {
      this.dragCounter++;
      dropZone.classList.add("active");
    });
    document.body.addEventListener("dragleave", () => {
      this.dragCounter--;
      if (this.dragCounter === 0) dropZone.classList.remove("active");
    });
    document.body.addEventListener("drop", (e) => {
      this.dragCounter = 0;
      dropZone.classList.remove("active");
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        files.forEach((file) => this.addDesktopIcon(file));
        this.speak(`Added ${files.length} files to desktop`);
      }
    });
  },

  addDesktopIcon(file) {
    const desktop = document.getElementById("desktop-zone");
    const icon = document.createElement("div");
    icon.className = "desktop-icon";
    let iconClass = "fa-file";
    const fileType = file.type.split("/")[0];
    if (fileType === "image") iconClass = "fa-file-image";
    else if (fileType === "video") iconClass = "fa-file-video";
    else if (fileType === "audio") iconClass = "fa-file-audio";
    else if (file.type.includes("pdf")) iconClass = "fa-file-pdf";
    icon.innerHTML = `<i class="fas ${iconClass}"></i><span>${file.name.length > 12 ? file.name.substring(0, 12) + "..." : file.name}</span>`;
    desktop.appendChild(icon);
  },

  // ========== WALLPAPER ==========
  openWallpaperPicker() {
    document.getElementById("wallpaperModal").classList.add("active");
  },
  closeWallpaperPicker() {
    document.getElementById("wallpaperModal").classList.remove("active");
  },

  setWallpaper(url, type) {
    const wallpaper = document.getElementById("wallpaper-layer");
    wallpaper.innerHTML = "";
    if (type === "video") {
      const video = document.createElement("video");
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      const source = document.createElement("source");
      source.src = url;
      source.type = "video/mp4";
      video.appendChild(source);
      wallpaper.appendChild(video);
      video.play().catch((e) => console.log("Autoplay prevented:", e));
    } else {
      const img = document.createElement("img");
      img.src = url;
      wallpaper.appendChild(img);
    }
  },

  loadWallpaper() {
    if (!this.db) return;
    const tx = this.db.transaction(["sys_config"], "readonly");
    const store = tx.objectStore("sys_config");
    const req = store.get("wallpaper");
    req.onsuccess = (e) => {
      const result = e.target.result;
      if (result && result.value) {
        this.setWallpaper(result.value.url, result.value.type);
      }
    };
  },

  uploadWallpaper(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const type = file.type.startsWith("video") ? "video" : "image";
      const wallpaperData = {
        id: Date.now(),
        url: e.target.result,
        type: type,
        thumbnail: type === "image" ? e.target.result : null,
        name: file.name,
      };
      this.setWallpaper(e.target.result, type);
      this.closeWallpaperPicker();
      this.speak("Wallpaper set.");
      this.saveMediaToDB(wallpaperData);
      this.saveWallpaperPref(wallpaperData);
    };
    reader.readAsDataURL(file);
  },

  uploadPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const type = file.type.startsWith("video") ? "video" : "image";
      if (type === "video") {
        const video = document.createElement("video");
        video.src = e.target.result;
        video.currentTime = 1;
        video.addEventListener("loadeddata", () => {
          const canvas = document.createElement("canvas");
          canvas.width = 320;
          canvas.height = 180;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, 0, 0, 320, 180);
          const thumbnail = canvas.toDataURL("image/jpeg", 0.7);
          const mediaItem = {
            id: Date.now(),
            url: e.target.result,
            type: type,
            thumbnail: thumbnail,
            name: file.name,
          };
          this.saveMediaToDB(mediaItem, (success) => {
            if (success) {
              this.speak("Video uploaded.");
              this.refreshPhotosApp();
            }
          });
        });
      } else {
        const mediaItem = {
          id: Date.now(),
          url: e.target.result,
          type: type,
          thumbnail: e.target.result,
          name: file.name,
        };
        this.saveMediaToDB(mediaItem, (success) => {
          if (success) {
            this.speak("Photo uploaded.");
            this.refreshPhotosApp();
          }
        });
      }
    };
    reader.readAsDataURL(file);
  },

  loadPhotosGallery(winID) {
    if (!this.db) return;
    const tx = this.db.transaction(["media"], "readonly");
    const store = tx.objectStore("media");
    const req = store.getAll();

    req.onsuccess = (e) => {
      const files = e.target.result || [];
      const txConfig = this.db.transaction(["sys_config"], "readonly");
      const reqConfig = txConfig.objectStore("sys_config").get("wallpaper");

      reqConfig.onsuccess = (ev) => {
        const currentWall = ev.target.result ? ev.target.result.value : null;
        const container = document.getElementById(`gallery-container-${winID}`);
        if (!container) return;

        let html = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px;">`;

        if (files.length === 0) html += `<p style="grid-column: 1/-1; color: #888;">No photos or videos yet. Upload some!</p>`;

        files.forEach((file) => {
          const isActive = currentWall && currentWall.id === file.id ? "border: 3px solid var(--neon);" : "";
          const isVideo = file.type === "video";
          html += `
            <div style="position: relative;">
              <div onclick="BlueOS.setWallpaperFromDB(${file.id})" 
                style="height: 100px; background-image: url('${file.thumbnail || file.url}'); background-size: cover; background-position: center; border-radius: 8px; cursor: pointer; ${isActive} display: flex; align-items: center; justify-content: center; background-color: #000;">
                ${isVideo ? '<i class="fas fa-play-circle" style="font-size: 1.5rem; color: rgba(255,255,255,0.8);"></i>' : ""}
              </div>
              <button onclick="BlueOS.deleteMedia(${file.id})" style="position: absolute; top: 5px; right: 5px; background: rgba(255,0,0,0.7); border: none; color: white; width: 22px; height: 22px; border-radius: 50%; cursor: pointer; font-size: 10px;">
                <i class="fas fa-times"></i>
              </button>
            </div>`;
        });
        html += `</div>`;
        container.innerHTML = html;
      };
    };
  },

  refreshPhotosApp() {
    document.querySelectorAll(".win-frame").forEach((win) => {
      if (win.querySelector(".win-title").textContent.includes("Photos")) {
        win.remove();
        this.activeWindows--;
        if (this.activeWindows < 0) this.activeWindows = 0;
        setTimeout(() => this.openApp("photos"), 100);
      }
    });
  },

  setWallpaperFromDB(id) {
    if (!this.db) return;
    const tx = this.db.transaction(["media"], "readonly");
    const store = tx.objectStore("media");
    const req = store.get(id);
    req.onsuccess = (e) => {
      const file = e.target.result;
      if (file) {
        this.setWallpaper(file.url, file.type);
        this.saveWallpaperPref(file);
        this.refreshPhotosApp();
        this.speak("Wallpaper updated");
      }
    };
  },

  deleteMedia(id) {
    this.deleteMediaFromDB(id, () => {
      this.speak("Deleted.");
      this.refreshPhotosApp();
    });
  },

  // ========== CUSTOM APPS ==========
  saveCustomApp(winId) {
    const name = document.getElementById(`appName-${winId}`).value.trim();
    const icon = document.getElementById(`appIcon-${winId}`).value.trim();
    const html = document.getElementById(`appHTML-${winId}`).value.trim();
    if (!name || !html) {
      this.speak("Missing details");
      return;
    }
    const customApps = JSON.parse(localStorage.getItem("blueos-custom-apps") || "[]");
    customApps.push({ name, icon, html });
    localStorage.setItem("blueos-custom-apps", JSON.stringify(customApps));
    this.speak(`App ${name} saved`);
    this.refreshAppStudio();
  },

  refreshAppStudio() {
    document.querySelectorAll(".win-frame").forEach((win) => {
      if (win.querySelector(".win-title").textContent.includes("App Studio")) {
        win.remove();
        this.activeWindows--;
        setTimeout(() => this.openApp("appstudio"), 100);
      }
    });
  },

  launchCustomApp(index) {
    const customApps = JSON.parse(localStorage.getItem("blueos-custom-apps") || "[]");
    const app = customApps[index];
    if (!app) return;
    this.zIndex++;
    this.activeWindows++;
    this.AI.dock();
    const winID = `win-${Date.now()}`;
    const win = document.createElement("div");
    win.classList.add("win-frame", "active");
    win.id = winID;
    win.style.zIndex = this.zIndex;
    win.style.width = "600px";
    win.style.height = "500px";
    win.style.top = "100px";
    win.style.left = "100px";
    win.innerHTML = `
      <div class="win-head" id="head-${winID}">
        <div class="win-title"><i class="${app.icon}"></i> ${app.name}</div>
        <div class="win-controls">
          <button class="ctrl-btn ctrl-min" onclick="BlueOS.minimize('${winID}')"></button>
          <button class="ctrl-btn ctrl-max" onclick="BlueOS.maximize('${winID}')"></button>
          <button class="ctrl-btn ctrl-close" onclick="BlueOS.close('${winID}')"></button>
        </div>
      </div>
      <div class="win-body" style="padding: 0;">${app.html}</div>`;
    document.body.appendChild(win);
    this.makeDraggable(winID);
    this.focusWindow(winID);
    this.speak(`Launching ${app.name}`);
  },

  deleteCustomApp(index) {
    const customApps = JSON.parse(localStorage.getItem("blueos-custom-apps") || "[]");
    customApps.splice(index, 1);
    localStorage.setItem("blueos-custom-apps", JSON.stringify(customApps));
    this.speak("App deleted");
    this.refreshAppStudio();
  },

  shutdown() {
    this.speak("Shutting down Blue OS.");
    document.body.style.transition = "opacity 1s";
    document.body.style.opacity = "0";
    setTimeout(() => location.reload(), 1500);
  },

  AI: {
    dock() {
      document.getElementById("ai-orb-container").className = "orb-docked";
    },
    undock() {
      document.getElementById("ai-orb-container").className = "orb-center";
    },
  },
};

window.onload = () => BlueOS.init();
