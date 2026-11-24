(() => {
  "use strict";

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointerQuery = window.matchMedia("(pointer: fine)");
  const lowPowerQuery = window.matchMedia("(max-width: 720px)");
    const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  const allowedAudioTypes = new Set([
    "audio/mpeg",
    "audio/mp4",
    "audio/wav",
    "audio/ogg",
    "audio/webm",
    "audio/x-wav",
    "audio/mp3"
  ]);
  const allowedAudioExtensions = new Set(["mp3", "m4a", "wav", "ogg", "webm", "aac"]);
  const maxImageBytes = 5 * 1024 * 1024;
  const maxAudioBytes = 40 * 1024 * 1024;
  const maxCustomPhotos = 30;
  const maxCustomTracks = 20;
  const svgNamespace = "http://www.w3.org/2000/svg";

  const state = {
    theme: document.documentElement.dataset.theme === "day" ? "day" : "night",
    reducedMotion: motionQuery.matches,
    lowPower: lowPowerQuery.matches || (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4),
    photos: [],
    customPhotoCount: 0,
    photoSort: "newest",
    currentPhotoId: null,
    zoom: 1,
    importItems: [],
    importBusy: false,
    tracks: [],
    importedTrackCount: 0,
    currentTrackId: null,
    playing: false,
    volume: 0.65,
    muted: false,
    generatedPosition: 0,
    generatedStartedAt: 0,
    generatedStep: 0,
    isSeeking: false,
    visitedStars: new Set(),
    pointer: { x: 0, y: 0, targetX: 0, targetY: 0 },
    slideshow: {
      active: false,
      paused: false,
      duration: 5000,
      nextAt: 0,
      remaining: 5000,
      frameId: 0
    },
    confirmCallback: null,
    typewriterTimer: 0,
    typewriterFullText: "",
    storageMode: "indexeddb"
  };

  const listeners = new AbortController();
  const photoUrls = new Map();
  const audioUrls = new Map();
  const timeouts = new Set();
  const demoPhotos = createDemoPhotos();

  const builtInTracks = [
    {
      id: "moon-first-light",
      title: "Ánh Trăng Đầu Tiên",
      artist: "Love Under The Moonlight · Nhạc không lời",
      duration: 180,
      kind: "generated",
      root: 220,
      bpm: 62,
      waveform: "sine",
      warmth: 920
    },
    {
      id: "between-the-stars",
      title: "Giữa Những Vì Sao",
      artist: "Love Under The Moonlight · Nhạc không lời",
      duration: 195,
      kind: "generated",
      root: 196,
      bpm: 68,
      waveform: "triangle",
      warmth: 1120
    },
    {
      id: "eternal-promise",
      title: "Lời Hẹn Vĩnh Cửu",
      artist: "Love Under The Moonlight · Nhạc không lời",
      duration: 210,
      kind: "generated",
      root: 174.61,
      bpm: 58,
      waveform: "sine",
      warmth: 780
    }
  ];

  const letterParagraphs = [
    "Em yêu,",
    "Anh viết những dòng này vào một đêm trăng sáng, khi thành phố đã ngủ yên và chỉ còn tiếng gió nhẹ ngoài hiên. Nếu em đang đọc, anh mong rằng em sẽ mỉm cười — vì nụ cười ấy luôn là điều đẹp nhất trong ngày của anh.",
    "Cảm ơn em đã đến bên anh, không phải với một cuộc sống hoàn hảo, mà với tất cả những điều chân thật nhất. Cảm ơn em vì đã lắng nghe, vì đã kiên nhẫn, và vì đã yêu anh bằng cả sự dịu dàng mà anh đôi khi không biết mình xứng đáng.",
    "Anh không hứa rằng mọi ngày sẽ luôn dễ dàng. Nhưng anh hứa sẽ ở lại, sẽ nắm tay em khi đường xa, và sẽ nhớ rằng tình yêu không chỉ nằm ở những lời ngọt ngào. Nó còn ở những ly trà nóng, câu hỏi “hôm nay của em thế nào”, và việc luôn chọn nhau một lần nữa.",
    "Dù tương lai có mang đến bao điều chưa biết, anh vẫn muốn cùng em đi qua tất cả. Trong những buổi bình minh, trong những đêm mưa, trong cả những ngày mà chúng mình chỉ cần ngồi cạnh nhau và không nói gì.",
    "Giữa hàng triệu vì sao, anh vẫn tìm thấy một ánh sáng mang tên em. Và nếu được chọn lại, anh sẽ chọn em — mãi mãi."
  ];

  function safeStorageGet(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function safeStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function makeId(prefix) {
    const randomPart = window.crypto && typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return `${prefix}-${randomPart}`;
  }

  function formatTime(seconds) {
    const safeSeconds = Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds) : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** index;
    return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  }

  function formatDate(timestamp) {
    try {
      return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }).format(new Date(timestamp));
    } catch (error) {
      return new Date(timestamp).toLocaleDateString("vi-VN");
    }
  }

  function baseFileName(fileName) {
    return String(fileName || "Kỷ niệm").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  }

  function makeIcon(name, className = "icon") {
    const svg = document.createElementNS(svgNamespace, "svg");
    svg.setAttribute("class", className);
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS(svgNamespace, "use");
    use.setAttribute("href", `#icon-${name}`);
    svg.appendChild(use);
    return svg;
  }

  function later(callback, delay) {
    const timeoutId = window.setTimeout(() => {
      timeouts.delete(timeoutId);
      callback();
    }, delay);
    timeouts.add(timeoutId);
    return timeoutId;
  }

  function clearScheduledTimeouts() {
    timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeouts.clear();
  }

  function showToast(title, message = "", type = "info", duration = 4600) {
    const region = $("#toast-region");
    if (!region) return;
    while (region.children.length >= 3) {
      region.firstElementChild.remove();
    }

    const toast = document.createElement("div");
    toast.className = `toast is-${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");

    const icon = document.createElement("span");
    icon.className = "toast-icon";
    icon.appendChild(makeIcon(type === "success" ? "check" : type === "love" ? "heart" : type === "error" ? "close" : "sparkles"));

    const content = document.createElement("div");
    content.className = "toast-content";
    const titleElement = document.createElement("p");
    titleElement.className = "toast-title";
    titleElement.textContent = title;
    content.appendChild(titleElement);
    if (message) {
      const messageElement = document.createElement("p");
      messageElement.className = "toast-message";
      messageElement.textContent = message;
      content.appendChild(messageElement);
    }

    const close = document.createElement("button");
    close.className = "toast-close";
    close.type = "button";
    close.setAttribute("aria-label", "Đóng thông báo");
    close.appendChild(makeIcon("close"));

    toast.append(icon, content, close);
    region.appendChild(toast);

    let removeTimer = later(() => dismissToast(toast), duration);
    const dismiss = () => {
      window.clearTimeout(removeTimer);
      dismissToast(toast);
    };
    close.addEventListener("click", dismiss, { once: true });
    toast.addEventListener("mouseenter", () => window.clearTimeout(removeTimer), { passive: true });
    toast.addEventListener("mouseleave", () => {
      removeTimer = later(() => dismissToast(toast), 1800);
    }, { passive: true });
    return toast;
  }

  function dismissToast(toast) {
    if (!toast || !toast.isConnected || toast.classList.contains("is-leaving")) return;
    toast.classList.add("is-leaving");
    later(() => toast.remove(), 360);
  }

  function updateLoadingProgress(progress, message) {
    const bar = $("#loading-progress");
    const copy = $("#loading-copy");
    const status = $("#loading-status");
    if (bar) bar.style.width = `${progress}%`;
    if (copy && message) copy.textContent = message;
    if (status) status.textContent = message || `Đang tải ${progress}%`;
  }

  function finishLoading() {
    const loader = $("#loading-screen");
    if (!loader) return;
    loader.classList.add("is-finished");
    loader.setAttribute("aria-busy", "false");
    later(() => {
      loader.hidden = true;
    }, 950);
  }

  function createDemoPhotos() {
    const definitions = [
      {
        id: "demo-moon-lake",
        title: "Đêm trăng bên hồ",
        caption: "Nơi chúng mình ngồi nghe gió và kể cho nhau nghe cả một bầu trời.",
        offset: 6,
        scene: "lake"
      },
      {
        id: "demo-city-lights",
        title: "Những ánh đèn thành phố",
        caption: "Một buổi tối bình thường trở nên đặc biệt chỉ vì em đi bên anh.",
        offset: 5,
        scene: "city"
      },
      {
        id: "demo-beach-sunset",
        title: "Hoàng hôn bên biển",
        caption: "Chúng mình chạy theo sóng, cười thật lớn và để gió làm tóc rối.",
        offset: 4,
        scene: "beach"
      },
      {
        id: "demo-cafe-rain",
        title: "Quán nhỏ ngày mưa",
        caption: "Hai tách trà nóng, một cửa sổ mờ, và cả buổi chiều chỉ nói về nhau.",
        offset: 3,
        scene: "cafe"
      },
      {
        id: "demo-starry-picnic",
        title: "Picnic dưới sao",
        caption: "Một tấm thảm, vài trái cây, và hàng nghìn câu chuyện chưa kịp kể.",
        offset: 2,
        scene: "picnic"
      },
      {
        id: "demo-long-road",
        title: "Con đường của chúng mình",
        caption: "Chưa biết phía trước có gì, nhưng anh biết mình muôn cùng em đi tiếp.",
        offset: 1,
        scene: "road"
      }
    ];

    return definitions.map((definition) => ({
      ...definition,
      isDemo: true,
      createdAt: Date.now() - definition.offset * 86400000,
      dataUrl: createDemoIllustration(definition.scene, definition.title)
    }));
  }

  function createDemoIllustration(scene, title) {
    const palettes = {
      lake: ["#101536", "#292552", "#8d77bd", "#f4c6df"],
      city: ["#101329", "#292146", "#725ca7", "#f4b7d4"],
      beach: ["#55436f", "#c07c9d", "#f3b68f", "#ffe4b5"],
      cafe: ["#25233d", "#594360", "#a36f83", "#f2c6a5"],
      picnic: ["#101331", "#252451", "#7266ac", "#f2c5e4"],
      road: ["#161a38", "#343457", "#7b72a8", "#f6d2df"]
    };
    const palette = palettes[scene] || palettes.lake;
    const stars = Array.from({ length: 42 }, (_, index) => {
      const x = 24 + ((index * 83) % 952);
      const y = 20 + ((index * 47) % 310);
      const radius = index % 7 === 0 ? 2 : 1;
      return `<circle cx="${x}" cy="${y}" r="${radius}" fill="#fff" opacity="${0.25 + (index % 5) * 0.12}"/>`;
    }).join("");

    let scenery = "";
    if (scene === "lake") {
      scenery = `
        <circle cx="760" cy="145" r="58" fill="#f4f0ff" opacity=".92"/>
        <circle cx="785" cy="122" r="55" fill="#1a1c40"/>
        <path d="M0 380Q180 305 360 365T720 350T1000 370V600H0Z" fill="#171b3b"/>
        <path d="M0 420Q220 370 430 415T780 400T1000 425V600H0Z" fill="#11162f"/>
        <g stroke="#b8a9e6" stroke-width="2" opacity=".25">
          <path d="M620 420h250M570 447h340M660 478h190M520 510h420M610 542h270"/>
        </g>
        <g fill="#0b0e23">
          <circle cx="382" cy="382" r="13"/><path d="M369 410q13-24 26 0v75h-26Z"/>
          <circle cx="417" cy="389" r="12"/><path d="M405 416q12-22 24 0v69h-24Z"/>
        </g>`;
    } else if (scene === "city") {
      scenery = `
        <circle cx="170" cy="120" r="45" fill="#eee9ff" opacity=".85"/>
        <circle cx="190" cy="101" r="43" fill="#191b39"/>
        <g fill="#14172f">
          <path d="M0 350h120v250H0zM140 290h150v310H140zM310 370h110v230H310zM440 245h140v355H440zM600 325h130v275H600zM750 280h140v320H750zM910 355h90v245h-90z"/>
        </g>
        <g fill="#ffd9a3" opacity=".75">
          ${Array.from({ length: 54 }, (_, index) => `<rect x="${25 + ((index * 67) % 910)}" y="${330 + ((index * 43) % 210)}" width="8" height="12" rx="2"/>`).join("")}
        </g>
        <path d="M0 545Q300 515 500 548T1000 530V600H0Z" fill="#0c1026"/>
        <g stroke="#f6c7dd" stroke-width="3" opacity=".3"><path d="M80 600 420 420M920 600 580 420"/></g>`;
    } else if (scene === "beach") {
      scenery = `
        <circle cx="720" cy="245" r="82" fill="#ffe5b5" opacity=".9"/>
        <path d="M0 340Q250 290 500 340T1000 325V600H0Z" fill="#63849c" opacity=".75"/>
        <path d="M0 390Q260 350 520 398T1000 375V600H0Z" fill="#41647f"/>
        <path d="M0 470Q260 430 520 475T1000 450V600H0Z" fill="#d6b498"/>
        <path d="M0 505Q260 468 520 510T1000 488" fill="none" stroke="#fff1e6" stroke-width="8" opacity=".55"/>
        <g fill="#513e58">
          <circle cx="390" cy="414" r="12"/><path d="M378 440q12-23 24 0l8 70h-40Z"/>
          <circle cx="430" cy="420" r="11"/><path d="M419 445q11-21 22 0l7 65h-36Z"/>
        </g>`;
    } else if (scene === "cafe") {
      scenery = `
        <rect x="110" y="70" width="780" height="400" rx="190" fill="#1b1b35" stroke="#9b7288" stroke-width="10"/>
        <rect x="140" y="100" width="720" height="340" rx="165" fill="#3c3855"/>
        <g stroke="#b9a5ca" stroke-width="3" opacity=".3"><path d="M500 100v340M140 270h720"/></g>
        <g fill="#c5d8ef" opacity=".18">
          <circle cx="230" cy="170" r="5"/><circle cx="285" cy="220" r="4"/><circle cx="350" cy="150" r="3"/><circle cx="660" cy="180" r="5"/><circle cx="730" cy="260" r="4"/><circle cx="610" cy="330" r="3"/>
        </g>
        <path d="M0 490h1000v110H0z" fill="#29253c"/>
        <ellipse cx="500" cy="500" rx="250" ry="35" fill="#18182d"/>
        <g fill="#f2ddca">
          <path d="M390 455h75v50h-75z"/><path d="M535 455h75v50h-75z"/>
          <path d="M465 455q0-30 25-30t25 30" fill="none" stroke="#f2ddca" stroke-width="8"/>
          <path d="M610 455q0-30 25-30t25 30" fill="none" stroke="#f2ddca" stroke-width="8"/>
        </g>
        <g stroke="#d7c5df" stroke-width="3" opacity=".35"><path d="M428 420q-15-25 0-50M448 418q15-25 0-48M572 420q-15-25 0-50M592 418q15-25 0-48"/></g>`;
    } else if (scene === "picnic") {
      scenery = `
        <circle cx="790" cy="125" r="50" fill="#f4f0ff" opacity=".9"/><circle cx="812" cy="105" r="48" fill="#181a38"/>
        <path d="M0 420Q220 360 450 405T1000 385V600H0Z" fill="#182041"/>
        <path d="M0 485Q300 430 560 475T1000 455V600H0Z" fill="#10162f"/>
        <path d="M260 500 650 430 790 545 370 600Z" fill="#74547d" opacity=".8"/>
        <g fill="#f3c2d8"><circle cx="470" cy="505" r="13"/><circle cx="515" cy="495" r="10"/></g>
        <g fill="#e7d39d"><ellipse cx="575" cy="510" rx="22" ry="10"/><ellipse cx="620" cy="500" rx="18" ry="9"/></g>
        <g fill="#0b1025">
          <circle cx="395" cy="425" r="13"/><path d="M382 454q13-25 26 0v75h-26Z"/>
          <circle cx="438" cy="432" r="12"/><path d="M426 460q12-23 24 0v69h-24Z"/>
        </g>`;
    } else {
      scenery = `
        <circle cx="220" cy="135" r="48" fill="#eee9ff" opacity=".88"/><circle cx="240" cy="116" r="46" fill="#191c38"/>
        <path d="M0 360Q180 310 360 355T720 335T1000 360V600H0Z" fill="#222647"/>
        <path d="M440 600 565 345 655 345 740 600Z" fill="#3b3b5d"/>
        <path d="M580 600V370M596 600V348" stroke="#f4d99b" stroke-width="5" stroke-dasharray="28 25" opacity=".7"/>
        <g fill="#0c1026">
          <circle cx="540" cy="438" r="11"/><path d="M529 464q11-21 22 0v70h-22Z"/>
          <circle cx="573" cy="444" r="10"/><path d="M563 469q10-20 20 0v65h-20Z"/>
        </g>`;
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${palette[0]}"/><stop offset=".65" stop-color="${palette[1]}"/><stop offset="1" stop-color="${palette[2]}"/></linearGradient>
        <radialGradient id="glow"><stop stop-color="${palette[3]}" stop-opacity=".32"/><stop offset="1" stop-color="${palette[3]}" stop-opacity="0"/></radialGradient>
        <filter id="soft"><feGaussianBlur stdDeviation="18"/></filter>
      </defs>
      <rect width="1000" height="600" fill="url(#sky)"/>
      <ellipse cx="700" cy="210" rx="370" ry="250" fill="url(#glow)" filter="url(#soft)"/>
      ${stars}
      ${scenery}
      <rect x="18" y="18" width="964" height="564" rx="20" fill="none" stroke="#fff" stroke-opacity=".12"/>
      <text x="42" y="555" fill="#fff" opacity=".78" font-family="Georgia,serif" font-size="22" font-style="italic">${title.replace(/[<>&"]/g, "")}</text>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  const db = {
    name: "love-under-the-moonlight",
    version: 1,
    connection: null,
    opening: null,
    memoryPhotos: new Map(),
    memoryTracks: new Map(),

    open() {
      if (this.connection) return Promise.resolve(this.connection);
      if (this.opening) return this.opening;
      this.opening = new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) {
          state.storageMode = "memory";
          reject(new Error("IndexedDB không khả dụng"));
          return;
        }
        const request = indexedDB.open(this.name, this.version);
        request.onupgradeneeded = () => {
          const connection = request.result;
          if (!connection.objectStoreNames.contains("photos")) {
            connection.createObjectStore("photos", { keyPath: "id" });
          }
          if (!connection.objectStoreNames.contains("tracks")) {
            connection.createObjectStore("tracks", { keyPath: "id" });
          }
        };
        request.onsuccess = () => {
          this.connection = request.result;
          this.connection.onversionchange = () => {
            this.connection?.close();
            this.connection = null;
          };
          resolve(this.connection);
        };
        request.onerror = () => {
          state.storageMode = "memory";
          reject(request.error || new Error("Không thể mở IndexedDB"));
        };
        request.onblocked = () => {
          reject(new Error("IndexedDB đang bị chặn bởi một tab khác"));
        };
      }).catch((error) => {
        this.opening = null;
        throw error;
      });
      return this.opening;
    },

    async getAll(storeName) {
      const connection = await this.open();
      return new Promise((resolve, reject) => {
        const transaction = connection.transaction(storeName, "readonly");
        const request = transaction.objectStore(storeName).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    },

    async put(storeName, value) {
      const connection = await this.open();
      return new Promise((resolve, reject) => {
        const transaction = connection.transaction(storeName, "readwrite");
        const request = transaction.objectStore(storeName).put(value);
        request.onsuccess = () => resolve(value);
        request.onerror = () => reject(request.error);
      });
    },

    async delete(storeName, id) {
      const connection = await this.open();
      return new Promise((resolve, reject) => {
        const transaction = connection.transaction(storeName, "readwrite");
        const request = transaction.objectStore(storeName).delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },

    async clear(storeName) {
      const connection = await this.open();
      return new Promise((resolve, reject) => {
        const transaction = connection.transaction(storeName, "readwrite");
        const request = transaction.objectStore(storeName).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },

    close() {
      this.connection?.close();
      this.connection = null;
      this.opening = null;
    }
  };

  function readHiddenDemoIds() {
    try {
      const value = JSON.parse(safeStorageGet("moonlight-hidden-demos", "[]"));
      return new Set(Array.isArray(value) ? value : []);
    } catch (error) {
      return new Set();
    }
  }

  function saveHiddenDemoIds(ids) {
    safeStorageSet("moonlight-hidden-demos", JSON.stringify(Array.from(ids)));
  }

  async function loadPhotos() {
    let customPhotos = [];
    try {
      await db.open();
      customPhotos = await db.getAll("photos");
    } catch (error) {
      state.storageMode = "memory";
      customPhotos = Array.from(db.memoryPhotos.values());
    }
    const hiddenDemos = readHiddenDemoIds();
    const visibleDemos = demoPhotos.filter((photo) => !hiddenDemos.has(photo.id));
    state.photos = [...customPhotos, ...visibleDemos].sort((a, b) => b.createdAt - a.createdAt);
    state.customPhotoCount = customPhotos.length;
  }

  async function loadTracks() {
    let importedTracks = [];
    try {
      await db.open();
      importedTracks = await db.getAll("tracks");
    } catch (error) {
      state.storageMode = "memory";
      importedTracks = Array.from(db.memoryTracks.values());
    }
    importedTracks = importedTracks
      .filter((track) => track && track.kind === "local" && track.blob instanceof Blob)
      .sort((a, b) => a.createdAt - b.createdAt);
    state.tracks = [...builtInTracks, ...importedTracks];
    state.importedTrackCount = importedTracks.length;
    state.currentTrackId = builtInTracks[0].id;
  }

  function getPhotoUrl(photo, thumbnail = false) {
    if (!photo) return "";
    if (photo.isDemo) return photo.dataUrl;
    const key = `${photo.id}:${thumbnail ? "thumb" : "full"}`;
    if (photoUrls.has(key)) return photoUrls.get(key);
    const blob = thumbnail ? photo.thumbnail : photo.blob;
    if (!(blob instanceof Blob)) return "";
    const url = URL.createObjectURL(blob);
    photoUrls.set(key, url);
    return url;
  }

  function releasePhotoUrls(photoId) {
    for (const [key, url] of photoUrls.entries()) {
      if (key.startsWith(`${photoId}:`)) {
        URL.revokeObjectURL(url);
        photoUrls.delete(key);
      }
    }
  }

  function getAudioUrl(track) {
    if (!track || track.kind !== "local") return "";
    if (audioUrls.has(track.id)) return audioUrls.get(track.id);
    if (!(track.blob instanceof Blob)) return "";
    const url = URL.createObjectURL(track.blob);
    audioUrls.set(track.id, url);
    return url;
  }

  function sortedPhotos() {
    const photos = [...state.photos];
    if (state.photoSort === "oldest") return photos.sort((a, b) => a.createdAt - b.createdAt);
    if (state.photoSort === "title") return photos.sort((a, b) => a.title.localeCompare(b.title, "vi"));
    return photos.sort((a, b) => b.createdAt - a.createdAt);
  }

  function renderGallery() {
    const grid = $("#photo-grid");
    const empty = $("#gallery-empty");
    const count = $("#memory-count");
    const slideshowButton = $("#slideshow-trigger");
    const clearButton = $("#clear-gallery");
    if (!grid || !empty) return;

    grid.replaceChildren();
    const photos = sortedPhotos();
    photos.forEach((photo, index) => {
      const card = document.createElement("article");
      card.className = "photo-card";
      card.dataset.photoId = photo.id;
      card.style.animationDelay = `${Math.min(index * 55, 330)}ms`;

      const open = document.createElement("button");
      open.type = "button";
      open.className = "photo-open";
      open.setAttribute("aria-label", `Xem kỷ niệm: ${photo.title}`);
      const image = document.createElement("img");
      image.src = getPhotoUrl(photo, true);
      image.alt = photo.caption || photo.title;
      image.loading = "lazy";
      image.decoding = "async";
      image.width = photo.width || 800;
      image.height = photo.height || 600;
      const hint = document.createElement("span");
      hint.className = "photo-view-hint";
      hint.appendChild(makeIcon("expand"));
      open.append(image, hint);
      open.addEventListener("click", () => openLightbox(photo.id));

      const info = document.createElement("div");
      info.className = "photo-info";
      const titleRow = document.createElement("div");
      titleRow.className = "photo-title-row";
      const textGroup = document.createElement("div");
      textGroup.style.minWidth = "0";
      const title = document.createElement("h4");
      title.className = "photo-title";
      title.textContent = photo.title;
      title.title = photo.title;
      const caption = document.createElement("p");
      caption.className = "photo-caption";
      caption.textContent = photo.caption || "Một khoảnh khắc muốn giữ lại bên nhau.";
      textGroup.append(title, caption);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "icon-button photo-delete";
      remove.setAttribute("aria-label", `Xóa kỷ niệm: ${photo.title}`);
      remove.title = "Xóa kỷ niệm";
      remove.appendChild(makeIcon("trash"));
      remove.addEventListener("click", () => requestDeletePhoto(photo.id));
      titleRow.append(textGroup, remove);
      const date = document.createElement("span");
      date.className = "photo-date";
      date.textContent = `${photo.isDemo ? "Kỷ niệm mẫu · " : ""}${formatDate(photo.createdAt)}`;
      info.append(titleRow, date);
      card.append(open, info);
      grid.appendChild(card);
    });

    empty.hidden = photos.length > 0;
    grid.hidden = photos.length === 0;
    if (count) count.textContent = `${photos.length} kỷ niệm · ${state.customPhotoCount} ảnh của bạn`;
    if (slideshowButton) slideshowButton.disabled = photos.length === 0;
    if (clearButton) clearButton.disabled = photos.length === 0;
    updateStorageSummary();
  }

  async function updateStorageSummary() {
    const status = $("#storage-status");
    if (!status) return;
    if (state.storageMode === "memory") {
      status.textContent = "Trình duyệt không cho phép lưu bền vững; kỷ niệm sẽ chỉ còn trong phiên này.";
      return;
    }
    try {
      if (navigator.storage && typeof navigator.storage.estimate === "function") {
        const estimate = await navigator.storage.estimate();
        status.textContent = `Ảnh ở lại trên thiết bị · Khoảng ${formatBytes(estimate.usage || 0)} đang dùng`;
      } else {
        status.textContent = "Ảnh của bạn ở lại trên thiết bị, không gửi đi đâu cả.";
      }
    } catch (error) {
      status.textContent = "Ảnh của bạn ở lại trên thiết bị, không gửi đi đâu cả.";
    }
  }

  function validateImageFile(file) {
    if (!allowedImageTypes.has(file.type)) {
      return `${file.name}: định dạng chưa được hỗ trợ. Hãy chọn JPG, PNG hoặc WEBP.`;
    }
    if (file.size > maxImageBytes) {
      return `${file.name}: ảnh vượt quá 5 MB.`;
    }
    if (file.size === 0) {
      return `${file.name}: tệp ảnh trống hoặc bị lỗi.`;
    }
    return "";
  }

  async function loadImageSource(file) {
    if ("createImageBitmap" in window) {
      try {
        return await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch (error) {
        return loadImageElement(file);
      }
    }
    return loadImageElement(file);
  }

  function loadImageElement(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Không thể đọc ảnh"));
      };
      image.src = url;
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Không thể xử lý ảnh"));
      }, type, quality);
    });
  }

  async function optimizeImage(file) {
    const source = await loadImageSource(file);
    const sourceWidth = source.width || source.naturalWidth;
    const sourceHeight = source.height || source.naturalHeight;
    if (!sourceWidth || !sourceHeight) {
      if (typeof source.close === "function") source.close();
      throw new Error("Ảnh không có kích thước hợp lệ");
    }

    const maxEdge = 1800;
    const ratio = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * ratio));
    const height = Math.max(1, Math.round(sourceHeight * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#10122e";
    context.fillRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);

    const thumbRatio = Math.min(1, 640 / Math.max(width, height));
    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = Math.max(1, Math.round(width * thumbRatio));
    thumbCanvas.height = Math.max(1, Math.round(height * thumbRatio));
    const thumbContext = thumbCanvas.getContext("2d", { alpha: false });
    thumbContext.fillStyle = "#10122e";
    thumbContext.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
    thumbContext.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);

    const outputType = file.type === "image/png" ? "image/png" : "image/webp";
    const blob = await canvasToBlob(canvas, outputType, 0.88);
    const thumbnail = await canvasToBlob(thumbCanvas, "image/webp", 0.78);
    if (typeof source.close === "function") source.close();
    canvas.width = 0;
    canvas.height = 0;
    thumbCanvas.width = 0;
    thumbCanvas.height = 0;
    return { blob, thumbnail, width, height };
  }

  function releaseImportPreviews() {
    state.importItems.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    state.importItems = [];
  }

  async function preparePhotoImport(files) {
    if (state.importBusy) return;
    const fileList = Array.from(files || []);
    if (!fileList.length) return;
    releaseImportPreviews();

    const availableSlots = Math.max(0, maxCustomPhotos - state.customPhotoCount - state.importItems.length);
    const errors = [];
    const candidates = [];
    for (const file of fileList) {
      if (candidates.length >= availableSlots) {
        errors.push(`Chỉ có thể thêm ${availableSlots} ảnh nữa để giữ tổng số ảnh của bạn dưới ${maxCustomPhotos}.`);
        break;
      }
      const validationError = validateImageFile(file);
      if (validationError) {
        errors.push(validationError);
        continue;
      }
      candidates.push(file);
    }

    state.importBusy = true;
    const saveButton = $("#save-photos");
    if (saveButton) {
      saveButton.disabled = true;
      $("span", saveButton).textContent = "Đang chuẩn bị ảnh…";
    }
    showToast("Đang chuẩn bị kỷ niệm", "Ảnh được tối ưu ngay trên thiết bị của bạn.", "info", 2200);

    for (const file of candidates) {
      try {
        const optimized = await optimizeImage(file);
        state.importItems.push({
          id: makeId("photo"),
          file,
          title: baseFileName(file.name).slice(0, 80),
          caption: "",
          previewUrl: URL.createObjectURL(file),
          createdAt: Date.now(),
          originalName: file.name,
          ...optimized
        });
      } catch (error) {
        errors.push(`${file.name}: không thể xử lý ảnh này.`);
      }
    }

    state.importBusy = false;
    if (saveButton) {
      saveButton.disabled = state.importItems.length === 0;
      $("span", saveButton).textContent = "Lưu vào kỷ niệm";
    }
    if (!state.importItems.length) {
      showToast("Chưa thể thêm ảnh", errors[0] || "Hãy chọn ít nhất một ảnh hợp lệ.", "error", 6500);
      releaseImportPreviews();
      return;
    }

    renderImportList();
    openDialog($("#import-dialog"));
    if (errors.length) {
      $("#import-error").hidden = false;
      $("#import-error").textContent = errors.slice(0, 3).join(" ");
    }
  }

  function renderImportList() {
    const list = $("#import-list");
    const error = $("#import-error");
    if (!list) return;
    list.replaceChildren();
    if (error) {
      error.hidden = true;
      error.textContent = "";
    }

    state.importItems.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "import-item";
      row.dataset.importId = item.id;

      const thumb = document.createElement("div");
      thumb.className = "import-thumb";
      const image = document.createElement("img");
      image.src = item.previewUrl;
      image.alt = `Xem trước ${item.title}`;
      thumb.appendChild(image);

      const fields = document.createElement("div");
      fields.className = "import-fields";
      const fileName = document.createElement("span");
      fileName.className = "import-file-name";
      fileName.textContent = `${item.originalName} · ${formatBytes(item.file.size)}`;
      const titleLabel = document.createElement("label");
      titleLabel.textContent = "Tên kỷ niệm";
      const titleInput = document.createElement("input");
      titleInput.type = "text";
      titleInput.maxLength = 80;
      titleInput.value = item.title;
      titleInput.dataset.field = "title";
      titleLabel.appendChild(titleInput);
      const captionLabel = document.createElement("label");
      captionLabel.textContent = "Lời nhắn";
      const captionInput = document.createElement("input");
      captionInput.type = "text";
      captionInput.maxLength = 220;
      captionInput.value = item.caption;
      captionInput.placeholder = "Một điều bạn muốn nhớ…";
      captionInput.dataset.field = "caption";
      captionLabel.appendChild(captionInput);
      fields.append(fileName, titleLabel, captionLabel);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "import-remove";
      remove.setAttribute("aria-label", `Bỏ ảnh ${item.title} khỏi danh sách`);
      remove.appendChild(makeIcon("close"));
      remove.addEventListener("click", () => {
        const itemIndex = state.importItems.findIndex((entry) => entry.id === item.id);
        if (itemIndex >= 0) {
          URL.revokeObjectURL(state.importItems[itemIndex].previewUrl);
          state.importItems.splice(itemIndex, 1);
        }
        renderImportList();
        if (!state.importItems.length) $("#import-dialog").close();
        $("#save-photos").disabled = state.importItems.length === 0;
      });

      row.append(thumb, fields, remove);
      list.appendChild(row);
      titleInput.addEventListener("input", () => {
        state.importItems[index].title = titleInput.value;
      });
      captionInput.addEventListener("input", () => {
        state.importItems[index].caption = captionInput.value;
      });
    });
  }

  async function saveImportedPhotos(event) {
    event.preventDefault();
    if (state.importBusy || !state.importItems.length) return;
    state.importBusy = true;
    const saveButton = $("#save-photos");
    saveButton.disabled = true;
    $("span", saveButton).textContent = "Đang lưu kỷ niệm…";
    const saved = [];

    try {
      for (const item of state.importItems) {
        const record = {
          id: item.id,
          title: item.title.trim() || "Một kỷ niệm đáng nhớ",
          caption: item.caption.trim(),
          createdAt: item.createdAt,
          originalName: item.originalName,
          blob: item.blob,
          thumbnail: item.thumbnail,
          width: item.width,
          height: item.height,
          isDemo: false
        };
        if (state.storageMode === "memory") {
          db.memoryPhotos.set(record.id, record);
        } else {
          await db.put("photos", record);
        }
        saved.push(record);
      }
      state.photos.push(...saved);
      state.customPhotoCount += saved.length;
      state.photoSort = "newest";
      updateSortButtons();
      renderGallery();
      $("#import-dialog").close();
      showToast("Kỷ niệm đã được giữ lại", `${saved.length} ảnh được lưu an toàn trên thiết bị của bạn.`, "success");
      floatHearts(window.innerWidth / 2, window.innerHeight / 2, 8);
    } catch (error) {
      for (const record of saved) {
        try {
          if (state.storageMode === "memory") db.memoryPhotos.delete(record.id);
          else await db.delete("photos", record.id);
        } catch (cleanupError) {
          console.warn("Không thể hoàn tác một ảnh vừa lưu.", cleanupError);
        }
      }
      const quotaError = error && (error.name === "QuotaExceededError" || error.code === 22);
      showToast(
        "Không thể lưu thư viện",
        quotaError ? "Bộ nhớ trình duyệt đã hết. Hãy xóa bớt ảnh cũ hoặc chọn ít ảnh hơn." : "Đã xảy ra lỗi khi lưu ảnh. Vui lòng thử lại.",
        "error",
        7000
      );
    } finally {
      state.importBusy = false;
      saveButton.disabled = false;
      $("span", saveButton).textContent = "Lưu vào kỷ niệm";
      releaseImportPreviews();
      $("#photo-input").value = "";
    }
  }

  function requestDeletePhoto(photoId) {
    const photo = state.photos.find((entry) => entry.id === photoId);
    if (!photo) return;
    openConfirm({
      title: "Xóa kỷ niệm này?",
      description: `“${photo.title}” sẽ biến mất khỏi thư viện trên thiết bị này.`,
      confirmLabel: "Xóa kỷ niệm",
      onConfirm: async () => {
        try {
          if (photo.isDemo) {
            const hidden = readHiddenDemoIds();
            hidden.add(photo.id);
            saveHiddenDemoIds(hidden);
          } else if (state.storageMode === "memory") {
            db.memoryPhotos.delete(photo.id);
          } else {
            await db.delete("photos", photo.id);
          }
          state.photos = state.photos.filter((entry) => entry.id !== photoId);
          if (!photo.isDemo) state.customPhotoCount = Math.max(0, state.customPhotoCount - 1);
          releasePhotoUrls(photoId);
          renderGallery();
          if ($("#lightbox-dialog").open && state.currentPhotoId === photoId) {
            const remaining = sortedPhotos();
            if (remaining.length) {
              openLightbox(remaining[0].id);
            } else {
              $("#lightbox-dialog").close();
            }
          }
          showToast("Đã xóa kỷ niệm", "Một ngôi sao nhỏ đã được gửi vào bầu trời.", "info");
        } catch (error) {
          showToast("Không thể xóa ảnh", "Trình duyệt chưa cho phép thay đổi dữ liệu. Vui lòng thử lại.", "error");
        }
      }
    });
  }

  function requestClearGallery() {
    if (!state.photos.length) return;
    openConfirm({
      title: "Xóa toàn bộ thư viện?",
      description: "Tất cả ảnh bạn đã thêm và các kỷ niệm mẫu sẽ bị xóa khỏi thiết bị này. Hãy chắc chắn bạn đã sao lưu ảnh gốc.",
      confirmLabel: "Xóa tất cả",
      onConfirm: async () => {
        try {
          if (state.storageMode === "memory") {
            db.memoryPhotos.clear();
          } else {
            await db.clear("photos");
          }
          state.photos.forEach((photo) => releasePhotoUrls(photo.id));
          state.photos = [];
          state.customPhotoCount = 0;
          saveHiddenDemoIds(new Set(demoPhotos.map((photo) => photo.id)));
          renderGallery();
          if ($("#lightbox-dialog").open) $("#lightbox-dialog").close();
          showToast("Thư viện đã được dọn sạch", "Bạn luôn có thể bắt đầu lại với một kỷ niệm mới.", "success");
        } catch (error) {
          showToast("Không thể xóa thư viện", "Vui lòng thử lại sau ít phút.", "error");
        }
      }
    });
  }

  function updateSortButtons() {
    $$(".filter-button").forEach((button) => {
      const active = button.dataset.sort === state.photoSort;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function openDialog(dialog) {
    if (!dialog || dialog.open) return;
    dialog.showModal();
    syncModalState();
  }

  function closeDialog(dialog) {
    if (dialog && dialog.open) dialog.close();
  }

  function syncModalState() {
    const hasOpenDialog = Boolean($("dialog[open]"));
    document.body.classList.toggle("modal-open", hasOpenDialog);
    if (hasOpenDialog && !document.body.style.getPropertyValue("--scrollbar-width")) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.setProperty("--scrollbar-width", `${scrollbarWidth}px`);
    }
  }

  function openConfirm({ title, description, confirmLabel = "Xác nhận", onConfirm }) {
    const dialog = $("#confirm-dialog");
    $("#confirm-title").textContent = title;
    $("#confirm-description").textContent = description;
    $("#confirm-action").textContent = confirmLabel;
    state.confirmCallback = typeof onConfirm === "function" ? onConfirm : null;
    openDialog(dialog);
    $("[data-close-dialog='confirm-dialog']", dialog)?.focus();
  }

  function currentPhoto() {
    return state.photos.find((photo) => photo.id === state.currentPhotoId) || null;
  }

  function openLightbox(photoId) {
    const photo = state.photos.find((entry) => entry.id === photoId);
    if (!photo) return;
    state.currentPhotoId = photoId;
    state.zoom = 1;
    openDialog($("#lightbox-dialog"));
    renderLightbox();
  }

  function renderLightbox() {
    const photo = currentPhoto();
    if (!photo) return;
    const photos = sortedPhotos();
    const index = photos.findIndex((entry) => entry.id === photo.id);
    const image = $("#lightbox-image");
    const loading = $("#lightbox-loading");
    loading.hidden = false;
    image.classList.add("is-changing");
    image.src = getPhotoUrl(photo);
    image.alt = photo.caption || photo.title;
    image.style.setProperty("--zoom", "1");
    $("#lightbox-title").textContent = photo.title;
    $("#lightbox-counter").textContent = `Kỷ niệm ${index + 1} / ${photos.length}${photo.isDemo ? " · Ảnh mẫu" : ""}`;
    $("#edit-photo-title").value = photo.title;
    $("#edit-photo-caption").value = photo.caption || "";
    $("#lightbox-prev").disabled = photos.length <= 1;
    $("#lightbox-next").disabled = photos.length <= 1;
    $("#zoom-in").disabled = false;
    $("#zoom-out").disabled = true;
    state.zoom = 1;
    image.onload = () => {
      loading.hidden = true;
      image.classList.remove("is-changing");
    };
    image.onerror = () => {
      loading.hidden = true;
      image.classList.remove("is-changing");
      showToast("Không thể mở ảnh", "Dữ liệu ảnh có thể đã bị hỏng hoặc bị trình duyệt chặn.", "error");
    };
    resetSlideshowTimer();
  }

  function changePhoto(direction) {
    const photos = sortedPhotos();
    if (photos.length < 2) return;
    const index = photos.findIndex((photo) => photo.id === state.currentPhotoId);
    const nextIndex = (index + direction + photos.length) % photos.length;
    state.currentPhotoId = photos[nextIndex].id;
    renderLightbox();
  }

  function setZoom(value) {
    state.zoom = Math.min(3, Math.max(1, value));
    $("#lightbox-image").style.setProperty("--zoom", String(state.zoom));
    $("#zoom-in").disabled = state.zoom >= 3;
    $("#zoom-out").disabled = state.zoom <= 1;
    $("#lightbox-image-wrap").style.overflow = state.zoom > 1 ? "auto" : "hidden";
  }

  async function savePhotoEdits(event) {
    event.preventDefault();
    const photo = currentPhoto();
    if (!photo) return;
    photo.title = $("#edit-photo-title").value.trim() || "Một kỷ niệm đáng nhớ";
    photo.caption = $("#edit-photo-caption").value.trim();
    try {
      if (!photo.isDemo) {
        if (state.storageMode === "memory") db.memoryPhotos.set(photo.id, photo);
        else await db.put("photos", photo);
      }
      $("#lightbox-title").textContent = photo.title;
      renderGallery();
      showToast("Đã lưu thay đổi", "Tên và lời nhắn của kỷ niệm đã được cập nhật.", "success", 3200);
    } catch (error) {
      showToast("Chưa thể lưu thay đổi", "Vui lòng thử lại.", "error");
    }
  }

  function startSlideshow() {
    const photos = sortedPhotos();
    if (!photos.length) return;
    if (!$("#lightbox-dialog").open) openLightbox(photos[0].id);
    state.slideshow.active = true;
    state.slideshow.paused = false;
    state.slideshow.remaining = state.slideshow.duration;
    $("#slideshow-controls").hidden = false;
    updateSlideshowButton();
    resetSlideshowTimer();
    cancelAnimationFrame(state.slideshow.frameId);
    state.slideshow.frameId = requestAnimationFrame(updateSlideshowFrame);
  }

  function stopSlideshow() {
    state.slideshow.active = false;
    state.slideshow.paused = false;
    cancelAnimationFrame(state.slideshow.frameId);
    state.slideshow.frameId = 0;
    $("#slideshow-controls").hidden = true;
    $("#slideshow-progress-bar").style.width = "0%";
  }

  function toggleSlideshow() {
    if (!state.slideshow.active) {
      startSlideshow();
      return;
    }
    state.slideshow.paused = !state.slideshow.paused;
    if (state.slideshow.paused) {
      state.slideshow.remaining = Math.max(0, state.slideshow.nextAt - performance.now());
    } else {
      state.slideshow.nextAt = performance.now() + state.slideshow.remaining;
    }
    updateSlideshowButton();
  }

  function updateSlideshowButton() {
    const button = $("#slideshow-toggle");
    const label = state.slideshow.paused ? "Tiếp tục trình chiếu" : "Tạm dừng trình chiếu";
    button.replaceChildren(makeIcon(state.slideshow.paused ? "play" : "pause"));
    const text = document.createElement("span");
    text.textContent = state.slideshow.paused ? "Tiếp tục" : "Tạm dừng";
    button.appendChild(text);
    button.setAttribute("aria-label", label);
  }

  function resetSlideshowTimer() {
    if (!state.slideshow.active) return;
    state.slideshow.remaining = state.slideshow.duration;
    state.slideshow.nextAt = performance.now() + state.slideshow.duration;
  }

  function updateSlideshowFrame(now) {
    if (!state.slideshow.active || !$("#lightbox-dialog").open) return;
    if (!state.slideshow.paused && !document.hidden) {
      const progress = Math.min(1, Math.max(0, (now - (state.slideshow.nextAt - state.slideshow.duration)) / state.slideshow.duration));
      $("#slideshow-progress-bar").style.width = `${progress * 100}%`;
      if (now >= state.slideshow.nextAt) {
        changePhoto(1);
      }
    }
    state.slideshow.frameId = requestAnimationFrame(updateSlideshowFrame);
  }

  async function toggleFullscreen() {
    const dialog = $("#lightbox-dialog");
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (typeof dialog.requestFullscreen === "function") {
        await dialog.requestFullscreen();
      } else {
        showToast("Trình duyệt chưa hỗ trợ", "Bạn vẫn có thể xem ảnh trong cửa sổ hiện tại.", "info");
      }
    } catch (error) {
      showToast("Chưa thể vào toàn màn hình", "Hãy thử lại bằng nút toàn màn hình của trình duyệt.", "info");
    }
  }

  function openLetter() {
    const dialog = $("#letter-dialog");
    const date = $("#letter-date");
    date.textContent = new Intl.DateTimeFormat("vi-VN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(new Date());
    openDialog(dialog);
    startTypewriter();
    const trigger = $("#letter-trigger");
    const rect = trigger.getBoundingClientRect();
    floatHearts(rect.left + rect.width / 2, rect.top + rect.height / 2, 7);
  }

  function startTypewriter() {
    window.clearTimeout(state.typewriterTimer);
    const target = $("#typewriter-text");
    state.typewriterFullText = letterParagraphs.join("\n\n");
    target.setAttribute("aria-label", state.typewriterFullText);
    target.setAttribute("aria-live", "off");
    if (state.reducedMotion) {
      target.textContent = state.typewriterFullText;
      target.classList.remove("is-typing");
      return;
    }
    target.textContent = "";
    target.classList.add("is-typing");
    let index = 0;
    const typeNext = () => {
      if (!$("#letter-dialog").open) return;
      index += 1;
      target.textContent = state.typewriterFullText.slice(0, index);
      if (index < state.typewriterFullText.length) {
        const currentCharacter = state.typewriterFullText[index - 1];
        const delay = currentCharacter === "\n" ? 90 : /[.,!?…]/.test(currentCharacter) ? 130 : 19;
        state.typewriterTimer = window.setTimeout(typeNext, delay);
      } else {
        target.classList.remove("is-typing");
        target.setAttribute("aria-live", "polite");
      }
    };
    state.typewriterTimer = window.setTimeout(typeNext, 220);
  }

  function readVisitedStars() {
    try {
      const values = JSON.parse(safeStorageGet("moonlight-visited-stars", "[]"));
      return new Set(Array.isArray(values) ? values : []);
    } catch (error) {
      return new Set();
    }
  }

  function initUniverse() {
    state.visitedStars = readVisitedStars();
    const paths = $("#constellation-paths");
    const nodes = $$(".star-node");
    if (!paths) return;
    const points = nodes.map((node) => ({
      node,
      x: parseFloat(node.style.getPropertyValue("--x")) * 8,
      y: parseFloat(node.style.getPropertyValue("--y")) * 5.2
    }));
    const center = { x: 400, y: 260 };
    const order = [0, 1, 2, 3, 4, 5, 6];
    let pathData = `M ${points[order[0]].x} ${points[order[0]].y}`;
    order.slice(1).forEach((pointIndex) => {
      pathData += ` L ${points[pointIndex].x} ${points[pointIndex].y}`;
    });
    pathData += ` L ${center.x} ${center.y} Z`;
    const path = document.createElementNS(svgNamespace, "path");
    path.setAttribute("d", pathData);
    paths.appendChild(path);

    nodes.forEach((node, index) => {
      if (state.visitedStars.has(index)) node.classList.add("is-visited");
      node.addEventListener("click", () => revealStar(index));
    });
    updateCosmicProgress();
  }

  function revealStar(index) {
    const nodes = $$(".star-node");
    const node = nodes[index];
    if (!node) return;
    const message = $("#cosmic-message-text");
    state.visitedStars.add(index);
    node.classList.add("is-visited");
    safeStorageSet("moonlight-visited-stars", JSON.stringify(Array.from(state.visitedStars)));
    $$("#constellation-paths path").forEach((path) => path.classList.add("is-lit"));
    message.classList.add("is-changing");
    later(() => {
      message.textContent = node.dataset.message;
      message.classList.remove("is-changing");
    }, state.reducedMotion ? 0 : 220);
    updateCosmicProgress();
    const rect = node.getBoundingClientRect();
    spawnBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 16, false);
    if (state.visitedStars.size === nodes.length) {
      showToast("Bạn đã tìm thấy tất cả những ngôi sao", "Vũ trụ của chúng mình thêm một lần nữa tỏa sáng.", "love");
      floatHearts(window.innerWidth / 2, window.innerHeight / 2, 12);
    }
  }

  function updateCosmicProgress() {
    const total = $$(".star-node").length;
    const visited = state.visitedStars.size;
    $("#cosmic-message-progress").textContent = `${visited} / ${total} ngôi sao đã khám phá`;
    $("#cosmic-progress-bar").style.width = `${total ? (visited / total) * 100 : 0}%`;
  }

  function revealRandomStar() {
    const nodes = $$(".star-node");
    const unvisited = nodes.map((node, index) => index).filter((index) => !state.visitedStars.has(index));
    const pool = unvisited.length ? unvisited : nodes.map((node, index) => index);
    const index = pool[Math.floor(Math.random() * pool.length)];
    revealStar(index);
    nodes[index].focus({ preventScroll: true });
  }

  function wishOnMoon() {
    const messages = [
      "Điều ước của bạn đã được gửi theo một vì sao băng.",
      "Mong điều bạn đang mong sẽ đến thật nhẹ nhàng.",
      "Mặt trăng đã nghe thấy điều ước của bạn.",
      "Một điều tốt đẹp đang trên đường tìm đến bạn.",
      "Hãy giữ điều ước ấy thật gần trái tim."
    ];
    if (!state.reducedMotion) cosmicBackground?.burstShootingStars(state.lowPower ? 2 : 4);
    const rect = $("#moon-button").getBoundingClientRect();
    floatHearts(rect.left + rect.width / 2, rect.top + rect.height / 2, state.lowPower ? 5 : 9);
    spawnBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 22, false);
    showToast("Điều ước đã được gửi", messages[Math.floor(Math.random() * messages.length)], "love", 5200);
  }

  const audioEngine = {
    context: null,
    masterGain: null,
    nodes: new Set(),
    schedulerId: 0,

    async ensureContext() {
      if (!this.context) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) throw new Error("Web Audio không khả dụng");
        this.context = new AudioContextClass();
        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = state.muted ? 0 : state.volume;
        const compressor = this.context.createDynamicsCompressor();
        compressor.threshold.value = -20;
        compressor.knee.value = 18;
        compressor.ratio.value = 5;
        compressor.attack.value = 0.02;
        compressor.release.value = 0.4;
        this.masterGain.connect(compressor);
        compressor.connect(this.context.destination);
      }
      if (this.context.state === "suspended") await this.context.resume();
      return this.context;
    },

    registerNode(node) {
      this.nodes.add(node);
      node.addEventListener("ended", () => this.nodes.delete(node), { once: true });
      return node;
    },

    createPad(track) {
      const context = this.context;
      const now = context.currentTime;
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = track.warmth;
      filter.Q.value = 0.6;
      filter.connect(this.masterGain);

      const chord = [1, 1.25, 1.5, 2];
      chord.forEach((ratio, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = index % 2 === 0 ? track.waveform : "sine";
        oscillator.frequency.value = track.root * ratio;
        oscillator.detune.value = index % 2 === 0 ? -5 : 5;
        gain.gain.value = index === 0 ? 0.045 : 0.022;
        oscillator.connect(gain);
        gain.connect(filter);
        oscillator.start(now);
        this.registerNode(oscillator);
      });

      const lfo = context.createOscillator();
      const lfoGain = context.createGain();
      lfo.frequency.value = 0.07;
      lfoGain.gain.value = 240;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start(now);
      this.registerNode(lfo);
    },

    playNote(track) {
      const context = this.context;
      const scale = [0, 7, 12, 16, 19, 24, 19, 12, 7, 3, 12, 19];
      const semitone = scale[state.generatedStep % scale.length];
      const frequency = track.root * 2 * 2 ** (semitone / 12);
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.055, now + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
      oscillator.connect(gain);
      gain.connect(this.masterGain);
      oscillator.start(now);
      oscillator.stop(now + 2.5);
      this.registerNode(oscillator);
      state.generatedStep += 1;
    },

    startScheduler(track) {
      this.stopScheduler();
      const interval = (60 / track.bpm / 2) * 1000;
      this.playNote(track);
      this.schedulerId = window.setInterval(() => {
        if (!document.hidden && state.playing) this.playNote(track);
      }, interval);
    },

    stopScheduler() {
      if (this.schedulerId) window.clearInterval(this.schedulerId);
      this.schedulerId = 0;
    },

    stopNodes() {
      this.stopScheduler();
      this.nodes.forEach((node) => {
        try {
          node.stop();
        } catch (error) {
          // A node may already have ended between animation frames.
        }
      });
      this.nodes.clear();
    },

    setVolume(volume) {
      if (this.masterGain && this.context) {
        this.masterGain.gain.setTargetAtTime(volume, this.context.currentTime, 0.05);
      }
    },

    async close() {
      this.stopNodes();
      if (this.context && this.context.state !== "closed") {
        try {
          await this.context.close();
        } catch (error) {
          console.warn("Không thể đóng AudioContext.", error);
        }
      }
      this.context = null;
      this.masterGain = null;
    }
  };

  function currentTrack() {
    return state.tracks.find((track) => track.id === state.currentTrackId) || state.tracks[0] || null;
  }

  function renderPlaylist() {
    const list = $("#playlist");
    if (!list) return;
    list.replaceChildren();
    state.tracks.forEach((track, index) => {
      const item = document.createElement("li");
      item.className = `playlist-item${track.id === state.currentTrackId ? " is-active" : ""}`;
      item.dataset.trackId = track.id;

      const play = document.createElement("button");
      play.type = "button";
      play.className = "playlist-play";
      play.setAttribute("aria-label", track.id === state.currentTrackId && state.playing ? `Tạm dừng ${track.title}` : `Phát ${track.title}`);
      play.appendChild(makeIcon(track.id === state.currentTrackId && state.playing ? "pause" : "play"));
      play.addEventListener("click", () => {
        if (track.id === state.currentTrackId) togglePlayback();
        else selectTrack(track.id, true);
      });

      const info = document.createElement("div");
      info.className = "playlist-info";
      const title = document.createElement("span");
      title.className = "playlist-title";
      title.textContent = track.title;
      const artist = document.createElement("span");
      artist.className = "playlist-artist";
      artist.textContent = track.artist;
      info.append(title, artist);

      const duration = document.createElement("span");
      duration.className = "playlist-duration";
      duration.textContent = track.duration ? formatTime(track.duration) : "—";

      item.append(play, info, duration);
      if (track.kind === "local") {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "icon-button playlist-remove";
        remove.setAttribute("aria-label", `Xóa bài hát ${track.title}`);
        remove.appendChild(makeIcon("close"));
        remove.addEventListener("click", () => requestDeleteTrack(track.id));
        item.appendChild(remove);
      }
      item.addEventListener("dblclick", () => selectTrack(track.id, true));
      list.appendChild(item);
      item.dataset.index = String(index);
    });
    updatePlayerUI();
  }

  function updatePlayerUI() {
    const track = currentTrack();
    const player = $(".music-player");
    if (!track || !player) return;
    $("#track-title").textContent = track.title;
    $("#track-artist").textContent = track.artist;
    $("#player-status").textContent = state.playing ? "Đang phát dưới ánh trăng" : "Sẵn sàng lắng nghe";
    player.classList.toggle("is-playing", state.playing);
    const playButton = $("#play-toggle");
    playButton.setAttribute("aria-pressed", String(state.playing));
    playButton.setAttribute("aria-label", state.playing ? "Tạm dừng nhạc" : "Phát nhạc");
    const duration = track.duration || 0;
    const position = getPlaybackPosition();
    $("#track-duration").textContent = duration ? formatTime(duration) : "—:—";
    $("#current-time").textContent = formatTime(position);
    const progress = $("#track-progress");
    progress.max = String(duration || 180);
    if (!state.isSeeking) progress.value = String(Math.min(position, duration || 180));
    progress.setAttribute("aria-valuetext", `${formatTime(position)} trên ${duration ? formatTime(duration) : "chưa biết"}`);
    progress.style.setProperty("--range-progress", `${duration ? Math.min(100, (position / duration) * 100) : 0}%`);
    $("#volume-control").value = String(Math.round(state.volume * 100));
    $("#volume-control").style.setProperty("--range-progress", `${state.volume * 100}%`);
    $("#volume-value").textContent = `${Math.round(state.volume * 100)}%`;
    $("#mute-toggle").setAttribute("aria-pressed", String(state.muted));
    $("#mute-toggle").setAttribute("aria-label", state.muted ? "Bật tiếng" : "Tắt tiếng");
    $$(".playlist-item").forEach((item) => {
      const itemTrack = state.tracks.find((entry) => entry.id === item.dataset.trackId);
      if (!itemTrack) return;
      const active = itemTrack.id === track.id;
      item.classList.toggle("is-active", active);
      const button = $(".playlist-play", item);
      const duration = $(".playlist-duration", item);
      if (duration) duration.textContent = itemTrack.duration ? formatTime(itemTrack.duration) : "—";
      if (button) {
        button.replaceChildren(makeIcon(active && state.playing ? "pause" : "play"));
        button.setAttribute("aria-label", active && state.playing ? `Tạm dừng ${itemTrack.title}` : `Phát ${itemTrack.title}`);
      }
    });
  }

  function getPlaybackPosition() {
    const track = currentTrack();
    if (!track) return 0;
    if (track.kind === "generated") {
      if (state.playing) {
        return Math.min(track.duration, (performance.now() - state.generatedStartedAt) / 1000);
      }
      return Math.min(track.duration, state.generatedPosition);
    }
    const audio = $("#audio-element");
    return Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  }

  async function playCurrentTrack() {
    const track = currentTrack();
    if (!track) return;
    try {
      if (track.kind === "generated") {
        $("#audio-element").pause();
        await audioEngine.ensureContext();
        audioEngine.stopNodes();
        audioEngine.createPad(track);
        state.generatedStartedAt = performance.now() - state.generatedPosition * 1000;
        audioEngine.startScheduler(track);
      } else {
        audioEngine.stopNodes();
        const audio = $("#audio-element");
        const url = getAudioUrl(track);
        if (!url) throw new Error("Không tìm thấy tệp nhạc");
        if (audio.src !== url) audio.src = url;
        audio.volume = state.muted ? 0 : state.volume;
        if (state.generatedPosition > 0 && state.generatedPosition < (track.duration || Infinity)) {
          audio.currentTime = state.generatedPosition;
        }
        await audio.play();
        state.generatedPosition = audio.currentTime;
      }
      state.playing = true;
      startPlaybackTicker();
      updatePlayerUI();
    } catch (error) {
      state.playing = false;
      audioEngine.stopNodes();
      updatePlayerUI();
      showToast("Chưa thể phát nhạc", "Trình duyệt có thể đang chặn âm thanh hoặc tệp nhạc không được hỗ trợ.", "error", 6000);
    }
  }

  function pausePlayback() {
    const track = currentTrack();
    if (track?.kind === "generated" && state.playing) {
      state.generatedPosition = getPlaybackPosition();
      audioEngine.stopNodes();
    } else if (track?.kind === "local") {
      state.generatedPosition = $("#audio-element").currentTime;
      $("#audio-element").pause();
    }
    state.playing = false;
    stopPlaybackTicker();
    updatePlayerUI();
  }

  function togglePlayback() {
    if (state.playing) pausePlayback();
    else playCurrentTrack();
  }

  function selectTrack(trackId, autoplay = false) {
    const wasPlaying = state.playing;
    pausePlayback();
    state.currentTrackId = trackId;
    state.generatedPosition = 0;
    state.generatedStep = 0;
    $("#audio-element").removeAttribute("src");
    $("#audio-element").load();
    renderPlaylist();
    if (autoplay || wasPlaying) playCurrentTrack();
  }

  function changeTrack(direction) {
    if (!state.tracks.length) return;
    const index = state.tracks.findIndex((track) => track.id === state.currentTrackId);
    const nextIndex = (index + direction + state.tracks.length) % state.tracks.length;
    selectTrack(state.tracks[nextIndex].id, state.playing);
  }

  function seekPlayback(value) {
    const track = currentTrack();
    if (!track) return;
    const position = Math.max(0, Math.min(Number(value) || 0, track.duration || 180));
    if (track.kind === "generated") {
      state.generatedPosition = position;
      if (state.playing) {
        audioEngine.stopNodes();
        audioEngine.createPad(track);
        state.generatedStartedAt = performance.now() - position * 1000;
        audioEngine.startScheduler(track);
      }
    } else {
      const audio = $("#audio-element");
      if (audio.readyState >= 1) audio.currentTime = position;
      state.generatedPosition = position;
    }
    updatePlayerUI();
  }

  function setVolume(value) {
    state.volume = Math.min(1, Math.max(0, Number(value) / 100));
    if (state.volume > 0) state.muted = false;
    audioEngine.setVolume(state.muted ? 0 : state.volume);
    $("#audio-element").volume = state.muted ? 0 : state.volume;
    updatePlayerUI();
  }

  function toggleMute() {
    state.muted = !state.muted;
    audioEngine.setVolume(state.muted ? 0 : state.volume);
    $("#audio-element").volume = state.muted ? 0 : state.volume;
    updatePlayerUI();
  }

  let playbackTickerId = 0;

  function startPlaybackTicker() {
    if (playbackTickerId) return;
    playbackTickerId = window.setInterval(() => {
      const track = currentTrack();
      if (!track || !state.playing) return;
      const position = getPlaybackPosition();
      if (track.duration && position >= track.duration - 0.05) {
        changeTrack(1);
        return;
      }
      updatePlayerUI();
    }, 220);
  }

  function stopPlaybackTicker() {
    if (playbackTickerId) window.clearInterval(playbackTickerId);
    playbackTickerId = 0;
  }

  function validateAudioFile(file) {
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!allowedAudioTypes.has(file.type) && !allowedAudioExtensions.has(extension)) {
      return `${file.name}: định dạng âm thanh chưa được hỗ trợ.`;
    }
    if (file.size > maxAudioBytes) return `${file.name}: tệp nhạc vượt quá 40 MB.`;
    if (file.size === 0) return `${file.name}: tệp nhạc trống hoặc bị lỗi.`;
    return "";
  }

  async function importAudioFiles(files) {
    const fileList = Array.from(files || []);
    if (!fileList.length) return;
    const availableSlots = Math.max(0, maxCustomTracks - state.importedTrackCount);
    const errors = [];
    const imported = [];
    for (const file of fileList) {
      if (imported.length >= availableSlots) {
        errors.push(`Bạn chỉ có thể thêm ${availableSlots} bài hát nữa.`);
        break;
      }
      const validationError = validateAudioFile(file);
      if (validationError) {
        errors.push(validationError);
        continue;
      }
      const track = {
        id: makeId("track"),
        title: baseFileName(file.name).slice(0, 80),
        artist: "Nhạc của bạn · Lưu trên thiết bị",
        duration: 0,
        kind: "local",
        blob: file,
        createdAt: Date.now(),
        originalName: file.name
      };
      try {
        if (state.storageMode === "memory") db.memoryTracks.set(track.id, track);
        else await db.put("tracks", track);
        imported.push(track);
      } catch (error) {
        errors.push(`${file.name}: không thể lưu vào bộ nhớ trình duyệt.`);
      }
    }
    if (imported.length) {
      state.tracks.push(...imported);
      state.importedTrackCount += imported.length;
      renderPlaylist();
      showToast("Đã thêm nhạc của bạn", `${imported.length} bài hát đã sẵn sàng trong danh sách phát.`, "success");
    }
    if (errors.length) showToast("Một số tệp chưa được thêm", errors.slice(0, 3).join(" "), "error", 7000);
    $("#audio-input").value = "";
  }

  function requestDeleteTrack(trackId) {
    const track = state.tracks.find((entry) => entry.id === trackId);
    if (!track || track.kind !== "local") return;
    openConfirm({
      title: "Xóa bài hát này?",
      description: `“${track.title}” sẽ bị xóa khỏi danh sách phát trên thiết bị này.`,
      confirmLabel: "Xóa bài hát",
      onConfirm: async () => {
        try {
          if (state.storageMode === "memory") db.memoryTracks.delete(trackId);
          else await db.delete("tracks", trackId);
          const wasCurrent = state.currentTrackId === trackId;
          if (wasCurrent) pausePlayback();
          state.tracks = state.tracks.filter((entry) => entry.id !== trackId);
          state.importedTrackCount = Math.max(0, state.importedTrackCount - 1);
          const url = audioUrls.get(trackId);
          if (url) URL.revokeObjectURL(url);
          audioUrls.delete(trackId);
          if (wasCurrent) {
            state.currentTrackId = state.tracks[0].id;
            state.generatedPosition = 0;
            $("#audio-element").removeAttribute("src");
            $("#audio-element").load();
          }
          renderPlaylist();
          showToast("Đã xóa bài hát", "Danh sách phát đã được cập nhật.", "info");
        } catch (error) {
          showToast("Không thể xóa bài hát", "Vui lòng thử lại.", "error");
        }
      }
    });
  }

  const cosmicBackground = {
    canvas: null,
    context: null,
    width: 0,
    height: 0,
    dpr: 1,
    stars: [],
    particles: [],
    shootingStars: [],
    galaxyCanvas: null,
    frameId: 0,
    lastTime: 0,
    nextShootAt: 0,
    running: false,

    init() {
      this.canvas = $("#cosmos-canvas");
      if (!this.canvas) return;
      this.context = this.canvas.getContext("2d", { alpha: true });
      this.buildGalaxy();
      this.resize();
      this.start();
    },

    buildGalaxy() {
      const size = 900;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      const center = size / 2;
      let seed = 47291;
      const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      const glow = context.createRadialGradient(center, center, 0, center, center, 390);
      glow.addColorStop(0, "rgba(255,247,224,0.48)");
      glow.addColorStop(0.08, "rgba(244,218,255,0.24)");
      glow.addColorStop(0.28, "rgba(174,142,244,0.13)");
      glow.addColorStop(0.62, "rgba(104,83,183,0.05)");
      glow.addColorStop(1, "rgba(50,42,110,0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, size, size);

      const colors = [
        "rgba(238,229,255,0.72)",
        "rgba(201,183,255,0.6)",
        "rgba(251,190,225,0.5)",
        "rgba(166,202,255,0.48)",
        "rgba(255,240,199,0.55)"
      ];
      for (let index = 0; index < 7200; index += 1) {
        const radius = Math.pow(random(), 0.62) * 370;
        const arm = Math.floor(random() * 3);
        const spread = (random() + random() + random() - 1.5) * (0.24 + radius / 900);
        const angle = radius * 0.021 + arm * ((Math.PI * 2) / 3) + spread;
        const x = center + Math.cos(angle) * radius;
        const y = center + Math.sin(angle) * radius * 0.68;
        const particleSize = random() < 0.96 ? 0.45 + random() * 1.05 : 1.5 + random() * 1.3;
        context.fillStyle = colors[Math.floor(random() * colors.length)];
        context.globalAlpha = 0.25 + random() * 0.7;
        context.beginPath();
        context.arc(x, y, particleSize, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      this.galaxyCanvas = canvas;
    },

    createStars() {
      const area = this.width * this.height;
      const baseCount = state.lowPower ? 85 : 155;
      const count = Math.round(Math.min(baseCount, Math.max(55, area / 9500)));
      this.stars = Array.from({ length: count }, (_, index) => ({
        x: Math.random(),
        y: Math.random(),
        radius: 0.35 + Math.random() * (index % 13 === 0 ? 1.55 : 0.85),
        alpha: 0.25 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
        speed: 0.35 + Math.random() * 1.15,
        depth: 0.25 + Math.random() * 0.75,
        warm: Math.random() > 0.82
      }));
      const particleCount = state.lowPower ? 12 : 26;
      this.particles = Array.from({ length: particleCount }, () => ({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius: 0.6 + Math.random() * 1.3,
        speed: 0.08 + Math.random() * 0.22,
        drift: (Math.random() - 0.5) * 0.12,
        alpha: 0.15 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2
      }));
    },

    resize() {
      if (!this.canvas || !this.context) return;
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, state.lowPower ? 1.35 : 1.8);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.createStars();
      if (state.reducedMotion) this.drawStatic();
    },

    start() {
      if (this.running || state.reducedMotion || document.hidden) return;
      this.running = true;
      this.lastTime = performance.now();
      this.nextShootAt = this.lastTime + this.randomShootDelay();
      this.frameId = requestAnimationFrame((now) => this.frame(now));
    },

    stop() {
      this.running = false;
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    },

    randomShootDelay() {
      return 2800 + Math.random() * (state.lowPower ? 8500 : 6200);
    },

    frame(now) {
      if (!this.running || document.hidden || state.reducedMotion) {
        this.running = false;
        return;
      }
      const delta = Math.min(40, now - this.lastTime);
      this.lastTime = now;
      state.pointer.x += (state.pointer.targetX - state.pointer.x) * 0.035;
      state.pointer.y += (state.pointer.targetY - state.pointer.y) * 0.035;
      const context = this.context;
      context.clearRect(0, 0, this.width, this.height);
      this.drawGalaxy(now);
      this.drawStars(now, delta);
      this.updateShootingStars(now, delta);
      this.drawParticles(now, delta);
      if (now >= this.nextShootAt && this.shootingStars.length < 2) {
        this.spawnShootingStar();
        this.nextShootAt = now + this.randomShootDelay();
      }
      this.frameId = requestAnimationFrame((nextNow) => this.frame(nextNow));
    },

    drawGalaxy(now) {
      if (!this.galaxyCanvas) return;
      const context = this.context;
      const size = Math.max(this.width, this.height) * (state.lowPower ? 1.42 : 1.28);
      const x = this.width * 0.31 + state.pointer.x * 14 - Math.min(window.scrollY * 0.025, 80);
      const y = this.height * 0.29 + state.pointer.y * 10;
      context.save();
      context.globalAlpha = state.theme === "day" ? 0.2 : 0.68;
      context.translate(x, y);
      context.rotate(now * 0.000009);
      context.drawImage(this.galaxyCanvas, -size / 2, -size / 2, size, size);
      context.restore();
    },

    drawStars(now, delta) {
      const context = this.context;
      const scrollOffset = Math.min(window.scrollY * 0.035, 120);
      this.stars.forEach((star) => {
        const parallaxX = state.pointer.x * 16 * star.depth;
        const parallaxY = state.pointer.y * 12 * star.depth;
        const x = ((star.x * this.width + parallaxX) % this.width + this.width) % this.width;
        const y = ((star.y * this.height + parallaxY - scrollOffset * star.depth) % this.height + this.height) % this.height;
        const twinkle = 0.62 + Math.sin(now * 0.001 * star.speed + star.phase) * 0.38;
        const alpha = star.alpha * twinkle * (state.theme === "day" ? 0.42 : 1);
        context.fillStyle = star.warm
          ? `rgba(255,238,197,${alpha})`
          : `rgba(225,229,255,${alpha})`;
        context.beginPath();
        context.arc(x, y, star.radius, 0, Math.PI * 2);
        context.fill();
        if (star.radius > 1.45) {
          context.fillStyle = `rgba(235,230,255,${alpha * 0.3})`;
          context.fillRect(x - star.radius * 3, y - 0.3, star.radius * 6, 0.6);
          context.fillRect(x - 0.3, y - star.radius * 3, 0.6, star.radius * 6);
        }
      });
    },

    drawParticles(now, delta) {
      const context = this.context;
      this.particles.forEach((particle) => {
        particle.y -= particle.speed * (delta / 16.67);
        particle.x += particle.drift * (delta / 16.67);
        if (particle.y < -5) {
          particle.y = this.height + 5;
          particle.x = Math.random() * this.width;
        }
        if (particle.x < -5) particle.x = this.width + 5;
        if (particle.x > this.width + 5) particle.x = -5;
        const alpha = particle.alpha * (0.6 + Math.sin(now * 0.001 + particle.phase) * 0.4);
        context.fillStyle = `rgba(213,202,255,${alpha * (state.theme === "day" ? 0.35 : 1)})`;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      });
    },

    spawnShootingStar(origin = null) {
      const startX = origin ? origin.x : this.width * (0.15 + Math.random() * 0.7);
      const startY = origin ? origin.y : this.height * (0.08 + Math.random() * 0.42);
      const angle = origin ? -Math.PI / 3 + (Math.random() - 0.5) * 0.55 : -Math.PI / 4 + (Math.random() - 0.5) * 0.4;
      const speed = (state.lowPower ? 0.38 : 0.55) + Math.random() * 0.35;
      this.shootingStars.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        length: 70 + Math.random() * 100,
        life: 0,
        maxLife: 700 + Math.random() * 500,
        width: 1 + Math.random() * 1.2
      });
    },

    burstShootingStars(count = 3) {
      const rect = $("#moon-button")?.getBoundingClientRect();
      const origin = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
      for (let index = 0; index < count; index += 1) {
        later(() => this.spawnShootingStar(origin), index * 170);
      }
    },

    updateShootingStars(now, delta) {
      const context = this.context;
      for (let index = this.shootingStars.length - 1; index >= 0; index -= 1) {
        const star = this.shootingStars[index];
        star.life += delta;
        star.x += star.vx * (delta / 16.67);
        star.y += star.vy * (delta / 16.67);
        const progress = star.life / star.maxLife;
        const alpha = Math.sin(Math.min(1, progress) * Math.PI) * 0.9;
        const tailX = star.x - star.vx * star.length;
        const tailY = star.y - star.vy * star.length;
        const gradient = context.createLinearGradient(tailX, tailY, star.x, star.y);
        gradient.addColorStop(0, "rgba(196,181,255,0)");
        gradient.addColorStop(0.65, `rgba(225,218,255,${alpha * 0.4})`);
        gradient.addColorStop(1, `rgba(255,250,230,${alpha})`);
        context.strokeStyle = gradient;
        context.lineWidth = star.width;
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(tailX, tailY);
        context.lineTo(star.x, star.y);
        context.stroke();
        context.fillStyle = `rgba(255,252,238,${alpha})`;
        context.beginPath();
        context.arc(star.x, star.y, star.width * 1.3, 0, Math.PI * 2);
        context.fill();
        if (progress >= 1 || star.x < -200 || star.x > this.width + 200 || star.y > this.height + 200) {
          this.shootingStars.splice(index, 1);
        }
      }
    },

    drawStatic() {
      if (!this.context) return;
      const now = 1200;
      this.context.clearRect(0, 0, this.width, this.height);
      this.drawGalaxy(now);
      this.drawStars(now, 16);
      this.drawParticles(now, 16);
    },

    destroy() {
      this.stop();
      this.shootingStars = [];
      this.galaxyCanvas = null;
    }
  };

  const effects = {
    canvas: null,
    context: null,
    width: 0,
    height: 0,
    dpr: 1,
    particles: [],
    ripples: [],
    frameId: 0,
    cursorX: 0,
    cursorY: 0,
    ringX: 0,
    ringY: 0,
    pointerVisible: false,
    lastTrailX: 0,
    lastTrailY: 0,
    running: false,

    init() {
      this.canvas = $("#effects-canvas");
      if (!this.canvas) return;
      this.context = this.canvas.getContext("2d");
      this.resize();
      window.addEventListener("pointermove", (event) => this.onPointerMove(event), { passive: true, signal: listeners.signal });
      window.addEventListener("pointerdown", (event) => this.onPointerDown(event), { passive: true, signal: listeners.signal });
      window.addEventListener("pointerover", (event) => this.onPointerOver(event), { passive: true, signal: listeners.signal });
      document.documentElement.addEventListener("pointerleave", () => this.hideCursor(), { signal: listeners.signal });
      window.addEventListener("blur", () => this.hideCursor(), { signal: listeners.signal });
    },

    resize() {
      if (!this.canvas) return;
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, state.lowPower ? 1.35 : 1.8);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    },

    onPointerMove(event) {
      state.pointer.targetX = (event.clientX / this.width - 0.5) * 2;
      state.pointer.targetY = (event.clientY / this.height - 0.5) * 2;
      if (!finePointerQuery.matches || event.pointerType === "touch") return;
      this.pointerVisible = true;
      this.cursorX = event.clientX;
      this.cursorY = event.clientY;
      if (!this.ringX && !this.ringY) {
        this.ringX = event.clientX;
        this.ringY = event.clientY;
      }
      $("#cursor-dot")?.classList.add("is-visible");
      $("#cursor-ring")?.classList.add("is-visible");
      $("#cursor-dot")?.style.setProperty("transform", `translate3d(${event.clientX - 2.5}px, ${event.clientY - 2.5}px, 0)`);
      const distance = Math.hypot(event.clientX - this.lastTrailX, event.clientY - this.lastTrailY);
      if (!state.reducedMotion && distance > 13 && this.particles.length < (state.lowPower ? 35 : 75)) {
        this.spawnTrail(event.clientX, event.clientY);
        this.lastTrailX = event.clientX;
        this.lastTrailY = event.clientY;
      }
      this.start();
    },

    onPointerOver(event) {
      if (!finePointerQuery.matches) return;
      const interactive = event.target.closest("a, button, input, textarea, select, [role='button'], [tabindex]");
      $("#cursor-ring")?.classList.toggle("is-hovering", Boolean(interactive));
    },

    onPointerDown(event) {
      if (event.pointerType === "touch") {
        this.ripples.push({ x: event.clientX, y: event.clientY, life: 0, maxLife: 650 });
        floatHearts(event.clientX, event.clientY, state.lowPower ? 2 : 3);
        this.start();
        return;
      }
      if (event.button !== 0 || state.reducedMotion) return;
      spawnBurst(event.clientX, event.clientY, state.lowPower ? 10 : 20, false);
    },

    hideCursor() {
      this.pointerVisible = false;
      $("#cursor-dot")?.classList.remove("is-visible");
      $("#cursor-ring")?.classList.remove("is-visible");
    },

    spawnTrail(x, y) {
      const colors = ["#f9a8d4", "#c4b5fd", "#7dd3fc", "#fff4cf"];
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        life: 0,
        maxLife: 420 + Math.random() * 320,
        size: 0.8 + Math.random() * 1.7,
        color: colors[Math.floor(Math.random() * colors.length)],
        kind: "dot"
      });
    },

    start() {
      if (this.running || state.reducedMotion) return;
      this.running = true;
      this.frameId = requestAnimationFrame((now) => this.frame(now));
    },

    stop() {
      this.running = false;
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    },

    frame(now) {
      if (!this.lastFrameTime) this.lastFrameTime = now;
      const delta = Math.min(35, now - this.lastFrameTime);
      this.lastFrameTime = now;
      const context = this.context;
      context.clearRect(0, 0, this.width, this.height);

      for (let index = this.particles.length - 1; index >= 0; index -= 1) {
        const particle = this.particles[index];
        particle.life += delta;
        particle.x += particle.vx * (delta / 16.67);
        particle.y += particle.vy * (delta / 16.67);
        particle.vy += 0.006 * (delta / 16.67);
        const progress = particle.life / particle.maxLife;
        if (progress >= 1) {
          this.particles.splice(index, 1);
          continue;
        }
        const alpha = (1 - progress) * 0.8;
        context.globalAlpha = alpha;
        context.fillStyle = particle.color;
        context.strokeStyle = particle.color;
        if (particle.kind === "heart") {
          context.font = `${particle.size * 4}px serif`;
          context.fillText("♥", particle.x, particle.y);
        } else if (particle.kind === "line") {
          context.lineWidth = particle.size * 0.55;
          context.beginPath();
          context.moveTo(particle.x, particle.y);
          context.lineTo(particle.x - particle.vx * 4, particle.y - particle.vy * 4);
          context.stroke();
        } else {
          context.beginPath();
          context.arc(particle.x, particle.y, particle.size * (1 - progress * 0.5), 0, Math.PI * 2);
          context.fill();
        }
      }

      for (let index = this.ripples.length - 1; index >= 0; index -= 1) {
        const ripple = this.ripples[index];
        ripple.life += delta;
        const progress = ripple.life / ripple.maxLife;
        if (progress >= 1) {
          this.ripples.splice(index, 1);
          continue;
        }
        context.globalAlpha = (1 - progress) * 0.5;
        context.strokeStyle = "#f9a8d4";
        context.lineWidth = 1.2;
        context.beginPath();
        context.arc(ripple.x, ripple.y, 8 + progress * 46, 0, Math.PI * 2);
        context.stroke();
      }
      context.globalAlpha = 1;

      if (this.pointerVisible && finePointerQuery.matches) {
        this.ringX += (this.cursorX - this.ringX) * 0.16;
        this.ringY += (this.cursorY - this.ringY) * 0.16;
        $("#cursor-ring")?.style.setProperty("transform", `translate3d(${this.ringX}px, ${this.ringY}px, 0) translate(-50%, -50%)`);
      }

      if (this.particles.length || this.ripples.length || (this.pointerVisible && finePointerQuery.matches)) {
        this.frameId = requestAnimationFrame((nextNow) => this.frame(nextNow));
      } else {
        this.running = false;
        this.lastFrameTime = 0;
      }
    },

    destroy() {
      this.stop();
      this.particles = [];
      this.ripples = [];
    }
  };

  function spawnBurst(x, y, count = 18, hearts = false) {
    if (state.reducedMotion) return;
    const colors = ["#f9a8d4", "#c4b5fd", "#7dd3fc", "#ffe7a3", "#ffffff"];
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + Math.random() * 0.2;
      const speed = 0.7 + Math.random() * 2.8;
      effects.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 500 + Math.random() * 500,
        size: 0.8 + Math.random() * 1.8,
        color: colors[index % colors.length],
        kind: hearts && index % 4 === 0 ? "heart" : index % 3 === 0 ? "line" : "dot"
      });
    }
    if (effects.particles.length > 140) effects.particles.splice(0, effects.particles.length - 140);
    effects.start();
  }

  function floatHearts(x, y, count = 6) {
    if (state.reducedMotion) return;
    const container = $("#floating-hearts");
    if (!container) return;
    for (let index = 0; index < count; index += 1) {
      const heart = document.createElement("span");
      heart.className = "floating-heart";
      heart.textContent = index % 4 === 0 ? "✦" : "♥";
      heart.style.left = `${x + (Math.random() - 0.5) * 50}px`;
      heart.style.top = `${y + (Math.random() - 0.5) * 35}px`;
      heart.style.fontSize = `${11 + Math.random() * 15}px`;
      heart.style.setProperty("--heart-duration", `${2.6 + Math.random() * 1.8}s`);
      heart.style.setProperty("--heart-rise", `${-120 - Math.random() * 150}px`);
      heart.style.setProperty("--heart-drift", `${(Math.random() - 0.5) * 130}px`);
      heart.style.setProperty("--heart-rotate", `${(Math.random() - 0.5) * 60}deg`);
      heart.style.color = index % 3 === 0 ? "#ffe7a3" : "#f9a8d4";
      container.appendChild(heart);
      later(() => heart.remove(), 4700);
    }
    while (container.children.length > 45) {
      container.firstElementChild.remove();
    }
  }

  function initTheme() {
    const button = $("#theme-toggle");
    const updateButton = () => {
      const day = state.theme === "day";
      button.setAttribute("aria-pressed", String(day));
      button.setAttribute("aria-label", day ? "Chuyển sang chế độ ban đêm" : "Chuyển sang chế độ ban ngày");
      $("meta[name='theme-color']").setAttribute("content", day ? "#eaf1ff" : "#080b22");
    };
    updateButton();
    button.addEventListener("click", () => {
      state.theme = state.theme === "night" ? "day" : "night";
      document.documentElement.dataset.theme = state.theme;
      safeStorageSet("moonlight-theme", state.theme);
      updateButton();
      const wipe = $("#page-wipe");
      wipe.classList.add("is-active");
      later(() => wipe.classList.remove("is-active"), 180);
      if (state.reducedMotion) cosmicBackground.drawStatic();
      showToast(
        state.theme === "day" ? "Một buổi bình minh dịu dàng" : "Đêm trăng lại trở về",
        state.theme === "day" ? "Ánh sáng ngày mai vẫn luôn có em trong đó." : "Bầu trời đã chuyển sang sắc tím của những đêm sao.",
        "love",
        3200
      );
    });
  }

  function initNavigation() {
    const header = $("#site-header");
    const menu = $("#mobile-menu");
    const menuButton = $("#menu-toggle");
    let scrollScheduled = false;

    const updateScrollState = () => {
      scrollScheduled = false;
      const scrollTop = window.scrollY;
      header.classList.toggle("is-scrolled", scrollTop > 24);
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? Math.min(100, (scrollTop / scrollable) * 100) : 0;
      $("#reading-progress-bar").style.width = `${progress}%`;
      $("#back-to-top").classList.toggle("is-visible", scrollTop > 700);
    };

    window.addEventListener("scroll", () => {
      if (!scrollScheduled) {
        scrollScheduled = true;
        requestAnimationFrame(updateScrollState);
      }
    }, { passive: true, signal: listeners.signal });
    updateScrollState();

    const setMenu = (open) => {
      menu.classList.toggle("is-open", open);
      menu.inert = !open;
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "Đóng menu điều hướng" : "Mở menu điều hướng");
      document.body.classList.toggle("menu-open", open);
      if (open) {
        later(() => $(".mobile-nav-link", menu)?.focus(), 80);
      } else {
        menuButton.focus({ preventScroll: true });
      }
    };

    menuButton.addEventListener("click", () => setMenu(menuButton.getAttribute("aria-expanded") !== "true"));
    $$(".mobile-nav-link", menu).forEach((link) => {
      link.addEventListener("click", () => setMenu(false));
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menu.classList.contains("is-open")) {
        setMenu(false);
      }
      if (event.key === "Tab" && menu.classList.contains("is-open")) {
        const focusable = [menuButton, ...$$("a, button:not([disabled])", menu)];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }, { signal: listeners.signal });

    $("#back-to-top").addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: state.reducedMotion ? "auto" : "smooth" });
    });

    const sections = $$("main section[id]");
    const navLinks = $$(".nav-link");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`);
        });
      });
    }, { rootMargin: "-30% 0px -58% 0px", threshold: 0 });
    sections.forEach((section) => observer.observe(section));

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    $$(".reveal").forEach((element) => revealObserver.observe(element));

    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      });
    }, { threshold: 0.65 });
    $$(".counter").forEach((counter) => counterObserver.observe(counter));
  }

  function animateCounter(element) {
    const target = Number(element.dataset.target) || 0;
    const suffix = element.dataset.suffix || "";
    if (state.reducedMotion) {
      element.textContent = `${target.toLocaleString("vi-VN")}${suffix}`;
      return;
    }
    const start = performance.now();
    const duration = 1500;
    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      element.textContent = `${Math.round(target * eased).toLocaleString("vi-VN")}${suffix}`;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function initMagneticButtons() {
    if (!finePointerQuery.matches || state.reducedMotion) return;
    $$(".magnetic").forEach((button) => {
      button.addEventListener("pointermove", (event) => {
        const rect = button.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width - 0.5) * 9;
        const y = ((event.clientY - rect.top) / rect.height - 0.5) * 7;
        button.style.setProperty("--magnet-x", `${x}px`);
        button.style.setProperty("--magnet-y", `${y}px`);
      }, { passive: true });
      button.addEventListener("pointerleave", () => {
        button.style.setProperty("--magnet-x", "0px");
        button.style.setProperty("--magnet-y", "0px");
      }, { passive: true });
    });
  }

  function initDialogs() {
    $$("[data-close-dialog]").forEach((button) => {
      button.addEventListener("click", () => closeDialog(document.getElementById(button.dataset.closeDialog)));
    });
    $$("dialog").forEach((dialog) => {
      dialog.addEventListener("close", () => {
        syncModalState();
        if (dialog.id === "letter-dialog") {
          window.clearTimeout(state.typewriterTimer);
          $("#typewriter-text").classList.remove("is-typing");
        }
        if (dialog.id === "import-dialog") {
          releaseImportPreviews();
          $("#import-error").hidden = true;
        }
        if (dialog.id === "lightbox-dialog") {
          stopSlideshow();
          state.currentPhotoId = null;
          state.zoom = 1;
        }
        if (dialog.id === "confirm-dialog") {
          state.confirmCallback = null;
        }
      });
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
      });
    });

    $("#confirm-action").addEventListener("click", async () => {
      const callback = state.confirmCallback;
      closeDialog($("#confirm-dialog"));
      if (callback) {
        try {
          await callback();
        } catch (error) {
          console.error(error);
          showToast("Đã xảy ra lỗi", "Vui lòng thử lại.", "error");
        }
      }
    });
  }

  function initGalleryEvents() {
    const input = $("#photo-input");
    const zone = $("#upload-zone");
    const openPicker = () => {
      if (!state.importBusy) input.click();
    };
    $("#upload-trigger").addEventListener("click", openPicker);
    $("#empty-upload-trigger").addEventListener("click", openPicker);
    zone.addEventListener("click", openPicker);
    zone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPicker();
      }
    });
    input.addEventListener("change", () => preparePhotoImport(input.files));
    ["dragenter", "dragover"].forEach((eventName) => {
      zone.addEventListener(eventName, (event) => {
        event.preventDefault();
        zone.classList.add("is-dragging");
      });
    });
    ["dragleave", "drop"].forEach((eventName) => {
      zone.addEventListener(eventName, (event) => {
        event.preventDefault();
        zone.classList.remove("is-dragging");
      });
    });
    zone.addEventListener("drop", (event) => preparePhotoImport(event.dataTransfer?.files));
    $("#import-form").addEventListener("submit", saveImportedPhotos);
    $("#clear-gallery").addEventListener("click", requestClearGallery);
    $("#slideshow-trigger").addEventListener("click", startSlideshow);
    $$(".filter-button").forEach((button) => {
      button.addEventListener("click", () => {
        state.photoSort = button.dataset.sort;
        updateSortButtons();
        renderGallery();
      });
    });
    $("#lightbox-prev").addEventListener("click", () => changePhoto(-1));
    $("#lightbox-next").addEventListener("click", () => changePhoto(1));
    $("#zoom-in").addEventListener("click", () => setZoom(state.zoom + 0.5));
    $("#zoom-out").addEventListener("click", () => setZoom(state.zoom - 0.5));
    $("#lightbox-image").addEventListener("dblclick", () => setZoom(state.zoom > 1 ? 1 : 2));
    $("#lightbox-image-wrap").addEventListener("wheel", (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom(state.zoom + (event.deltaY < 0 ? 0.25 : -0.25));
    }, { passive: false });
    $("#lightbox-fullscreen").addEventListener("click", toggleFullscreen);
    $("#lightbox-delete").addEventListener("click", () => {
      if (state.currentPhotoId) requestDeletePhoto(state.currentPhotoId);
    });
    $("#photo-edit-form").addEventListener("submit", savePhotoEdits);
    $("#slideshow-toggle").addEventListener("click", toggleSlideshow);

    let swipeStartX = 0;
    let swipeStartY = 0;
    const stage = $("#lightbox-stage");
    stage.addEventListener("pointerdown", (event) => {
      swipeStartX = event.clientX;
      swipeStartY = event.clientY;
    }, { passive: true });
    stage.addEventListener("pointerup", (event) => {
      if (state.zoom > 1) return;
      const deltaX = event.clientX - swipeStartX;
      const deltaY = event.clientY - swipeStartY;
      if (Math.abs(deltaX) > 55 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
        changePhoto(deltaX < 0 ? 1 : -1);
      }
    }, { passive: true });

    document.addEventListener("keydown", (event) => {
      if (!$("#lightbox-dialog").open) return;
      if (event.target.matches("input, textarea, select")) return;
      if (event.key === "ArrowLeft") changePhoto(-1);
      if (event.key === "ArrowRight") changePhoto(1);
      if (event.key === "+" || event.key === "=") setZoom(state.zoom + 0.5);
      if (event.key === "-") setZoom(state.zoom - 0.5);
      if (event.key === "0") setZoom(1);
      if (event.key === " " && event.target === document.body) {
        event.preventDefault();
        if (state.slideshow.active) toggleSlideshow();
      }
    });
  }

  function initLetterAndUniverseEvents() {
    $("#letter-trigger").addEventListener("click", openLetter);
    $("#hero-letter-button").addEventListener("click", openLetter);
    $("#envelope-button").addEventListener("click", openLetter);
    $("#moon-button").addEventListener("click", wishOnMoon);
    $("#random-star-button").addEventListener("click", revealRandomStar);
    $("#send-love-button").addEventListener("click", () => {
      const rect = $("#send-love-button").getBoundingClientRect();
      floatHearts(rect.left + rect.width / 2, rect.top + rect.height / 2, 16);
      spawnBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 28, true);
      showToast("Một trái tim đã được gửi", "Hy vọng em cảm nhận được tất cả yêu thương trong đó.", "love", 5000);
    });
  }

  function initMusicEvents() {
    const audio = $("#audio-element");
    $("#play-toggle").addEventListener("click", togglePlayback);
    $("#previous-track").addEventListener("click", () => changeTrack(-1));
    $("#next-track").addEventListener("click", () => changeTrack(1));
    $("#mute-toggle").addEventListener("click", toggleMute);
    $("#volume-control").addEventListener("input", (event) => setVolume(event.target.value));
    $("#add-music-trigger").addEventListener("click", () => $("#audio-input").click());
    $("#audio-input").addEventListener("change", () => importAudioFiles($("#audio-input").files));

    const progress = $("#track-progress");
    progress.addEventListener("pointerdown", () => {
      state.isSeeking = true;
    });
    progress.addEventListener("input", (event) => {
      const value = Number(event.target.value);
      const duration = currentTrack()?.duration || 180;
      progress.style.setProperty("--range-progress", `${(value / duration) * 100}%`);
      $("#current-time").textContent = formatTime(value);
    });
    progress.addEventListener("change", (event) => {
      seekPlayback(event.target.value);
      state.isSeeking = false;
      updatePlayerUI();
    });
    progress.addEventListener("pointerup", () => {
      state.isSeeking = false;
    });

    audio.addEventListener("loadedmetadata", () => {
      const track = currentTrack();
      if (!track || track.kind !== "local") return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        track.duration = audio.duration;
        if (state.storageMode === "memory") db.memoryTracks.set(track.id, track);
        else db.put("tracks", track).catch(() => {});
        updatePlayerUI();
      }
    });
    audio.addEventListener("ended", () => changeTrack(1));
    audio.addEventListener("error", () => {
      if (!audio.getAttribute("src")) return;
      state.playing = false;
      stopPlaybackTicker();
      updatePlayerUI();
      showToast("Không thể phát tệp nhạc", "Định dạng hoặc dữ liệu âm thanh có thể không được trình duyệt hỗ trợ.", "error", 6000);
    });
  }

  function initMotionLifecycle() {
    document.addEventListener("visibilitychange", () => {
      document.body.classList.toggle("page-hidden", document.hidden);
      if (document.hidden) {
        cosmicBackground.stop();
        effects.stop();
        if (state.slideshow.active && !state.slideshow.paused) {
          state.slideshow.remaining = Math.max(0, state.slideshow.nextAt - performance.now());
          state.slideshow.paused = true;
          updateSlideshowButton();
        }
        if (state.playing && currentTrack()?.kind === "generated") {
          state.resumeGeneratedOnVisible = true;
          pausePlayback();
        }
      } else {
        if (state.reducedMotion) cosmicBackground.drawStatic();
        else cosmicBackground.start();
        if (state.resumeGeneratedOnVisible) {
          state.resumeGeneratedOnVisible = false;
          playCurrentTrack();
        }
      }
    });

    const handleMotionChange = (event) => {
      state.reducedMotion = event.matches;
      document.documentElement.dataset.motion = state.reducedMotion ? "reduced" : "full";
      if (state.reducedMotion) {
        cosmicBackground.stop();
        cosmicBackground.drawStatic();
        effects.stop();
        effects.particles = [];
        effects.ripples = [];
      } else {
        cosmicBackground.start();
      }
    };
    if (typeof motionQuery.addEventListener === "function") {
      motionQuery.addEventListener("change", handleMotionChange);
    } else {
      motionQuery.addListener(handleMotionChange);
    }

    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        state.lowPower = lowPowerQuery.matches || (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
        cosmicBackground.resize();
        effects.resize();
        if (state.reducedMotion) cosmicBackground.drawStatic();
      }, 140);
    }, { passive: true, signal: listeners.signal });
  }

  function bindGlobalEvents() {
    initTheme();
    initNavigation();
    initMagneticButtons();
    initDialogs();
    initGalleryEvents();
    initLetterAndUniverseEvents();
    initMusicEvents();
    initMotionLifecycle();
    $("#current-year").textContent = String(new Date().getFullYear());
  }

  function cleanup() {
    listeners.abort();
    clearScheduledTimeouts();
    window.clearTimeout(state.typewriterTimer);
    cosmicBackground.destroy();
    effects.destroy();
    stopPlaybackTicker();
    stopSlideshow();
    audioEngine.close();
    $("#audio-element")?.pause();
    photoUrls.forEach((url) => URL.revokeObjectURL(url));
    audioUrls.forEach((url) => URL.revokeObjectURL(url));
    photoUrls.clear();
    audioUrls.clear();
    state.importItems.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    db.close();
  }

  async function init() {
    updateLoadingProgress(8, "Đang vẽ những vì sao đầu tiên…");
    cosmicBackground.init();
    effects.init();
    updateLoadingProgress(28, "Đang thắp sáng mặt trăng…");
    bindGlobalEvents();
    initUniverse();

    updateLoadingProgress(46, "Đang mở kho kỷ niệm của bạn…");
    await loadPhotos();
    renderGallery();

    updateLoadingProgress(68, "Đang chuẩn bị những giai điệu…");
    await loadTracks();
    renderPlaylist();

    updateLoadingProgress(86, "Đang kết nối mọi điều yêu thương…");
    const fontReady = document.fonts?.ready || Promise.resolve();
    await Promise.race([fontReady, new Promise((resolve) => later(resolve, 1400))]);
    updateLoadingProgress(100, "Mọi thứ đã sẵn sàng dưới ánh trăng.");
    later(finishLoading, 320);

    if (state.storageMode === "memory") {
      later(() => showToast(
        "Bộ nhớ cục bộ chưa khả dụng",
        "Trình duyệt đang ở chế độ riêng tư hoặc chặn IndexedDB. Ảnh và nhạc chỉ được giữ trong phiên hiện tại.",
        "error",
        8000
      ), 1200);
    }

    window.__moonlightApp = {
      version: "2.0.0",
      getState: () => ({
        theme: state.theme,
        reducedMotion: state.reducedMotion,
        photoCount: state.photos.length,
        customPhotoCount: state.customPhotoCount,
        trackCount: state.tracks.length,
        playing: state.playing,
        currentTrackId: state.currentTrackId,
        visitedStars: state.visitedStars.size,
        storageMode: state.storageMode,
        openDialog: $("dialog[open]")?.id || null
      }),
      openLightbox,
      revealStar,
      wishOnMoon,
      selectTrack
    };

    window.addEventListener("pagehide", (event) => {
      if (event.persisted) {
        cosmicBackground.stop();
        effects.stop();
        if (state.playing && currentTrack()?.kind === "generated") pausePlayback();
      } else {
        cleanup();
      }
    }, { signal: listeners.signal });
    window.addEventListener("beforeunload", cleanup, { once: true });
  }

  init().catch((error) => {
    console.error("Không thể khởi tạo trải nghiệm:", error);
    updateLoadingProgress(100, "Có một chút trục trặc, nhưng ánh trăng vẫn ở đây.");
    later(finishLoading, 500);
    showToast("Không thể tải hoàn toàn", "Hãy tải lại trang. Nếu lỗi vẫn tiếp diễn, hãy kiểm tra cài đặt quyền lưu trữ của trình duyệt.", "error", 9000);
  });
})();
