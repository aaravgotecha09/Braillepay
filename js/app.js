(function(){
"use strict";

/* ============================================================
   STARTUP SAFETY NET — deliberately placed before anything else
   in the script and written with zero dependencies on any other
   function here. If literally everything below this point were
   broken, this alone still guarantees the user reaches Home
   instead of being stuck on the splash screen forever.
   ============================================================ */
(function startupSafetyNet(){
  try{
    setTimeout(function(){
      try{
        var splash = document.getElementById('screen-splash');
        var home = document.getElementById('screen-home');
        if(splash && splash.classList.contains('active') && home){
          splash.classList.remove('active');
          home.classList.add('active');
        }
      }catch(e){ /* even this must never throw uncaught */ }
    }, 4000);
  }catch(e){ /* setTimeout itself is not expected to fail, but never trust it blindly */ }
})();

/* ============================================================
   BRAILLE DATA — the mapping table lives in js/braille-map.js
   (single source of truth, unit-tested). A character maps to a
   LIST of cells: most characters are one cell; the UEB symbols
   @ & = % _ / are two. See docs/BRAILLE_MAPPING.md for sources.
   ============================================================ */
const BP_BRAILLE = window.BraillePayBraille;
/* cells for one character (array of dot-arrays), or null if the character has no mapping */
function patternForRaw(ch){ return BP_BRAILLE.getCells(ch); }
/* first cell only — used for decorative and preview cells that show one cell per character */
function patternFor(ch){ const cells = patternForRaw(ch); return cells && cells.length ? cells[0] : []; }
function categoryFor(ch){ return BP_BRAILLE.categoryOf(ch); }

/* ============================================================
   BRAILLE PATTERN ABSTRACTION — a languageMode-aware entry point
   in front of the pattern table above.

   RAW QR VALUE -> IDENTIFIER PRESERVATION -> CHARACTER ANALYSIS
   -> BRAILLE REPRESENTATION -> HAPTIC OUTPUT

   "en" routes to the existing, fully working Grade-1 table above
   and is what verification/payment playback always uses — an
   identifier like "rahul123@ybl" is never transliterated or
   reinterpreted, regardless of the UI's selected language.

   "bharati-hi" / "bharati-mr" are named and reserved here but
   deliberately NOT implemented: Bharati Braille (the real Hindi/
   Marathi Braille standard) uses a different dot-pattern set than
   Grade-1 English Braille, and shipping a guessed or unverified
   mapping would teach someone an incorrect pattern for their own
   name or bank details — worse than not having it at all. Wire
   these up only against a verified, documented Bharati Braille
   table, tested for real, not estimated from English patterns.
   ============================================================ */
const BRAILLE_LANGUAGE_MODES_IMPLEMENTED = ['en'];
function getBraillePattern(character, languageMode){
  const mode = languageMode || 'en';
  if(mode === 'en') return patternForRaw(character);
  if(mode === 'bharati-hi' || mode === 'bharati-mr'){
    console.warn('[BraillePay] Braille mode "'+mode+'" is reserved but not implemented — no verified Bharati Braille table is wired in yet. Returning null rather than guessing a mapping.');
    return null;
  }
  console.warn('[BraillePay] Unknown Braille language mode "'+mode+'" — falling back to English Grade-1.');
  return patternForRaw(character);
}
/* ============================================================
   LANGUAGE — English, Hindi, Marathi. Covers spoken/announced
   feedback (the part that matters most for a blind user) plus
   the voice-assistant wake phrase and commands. Screen headers
   and static informational copy stay in English for this pass.
   ============================================================ */
const LANG = {
  en: {
    letter:'Letter', digit:'Digit', space:'Space', symbol:'Symbol', unsupported:'Unsupported symbol',
    listening_wake:'Listening for "Hey Braille"…', listening_cmd:'Listening for a command…',
    voice_on:'Voice assistant on. Say Hey Braille, then a command.',
    voice_default:'Say the wake phrase, then a command like "scan QR" or "check balance"',
    mic_denied:'Microphone permission denied — voice assistant is off.',
    unsupported:"Voice control isn't supported in this browser.",
    unlocked:'Unlocked', locked_idle:'Locked after inactivity, for your security',
    wrong_pin:'Incorrect PIN. Demo PIN is 1234 — try again.',
    lock_caption_bio:"Unlock with your device's biometrics, or use the demo PIN.",
    lock_caption_nobio:"Biometric authentication isn't available on this device or browser — enter the demo PIN instead.",
    verifying_bio:'Waiting for your fingerprint or face…',
    bio_mismatch:"Biometric check didn't match. Try again, or use your PIN below.",
    send_confirm:"Use your device's biometric prompt, or enter the demo PIN (1234).",
    send_wrong_pin:'Demo PIN is 1234 — try again.',
    opening:'Opening ', unlock_first:'Unlock BraillePay first',
    balance_speak:'Your demo balance is ₹', payment_success:'Payment successful. ',
    scr_home:'Home', scr_scan:'Scan QR', scr_send:'Send Money', scr_balance:'Balance',
    scr_settings:'Settings', scr_learning:'Learning Mode', scr_history:'History',

    skip_link:'Skip to content',
    splash_tag:'A blind-friendly way to verify what a QR code says — through sound and touch, never by giving away the answer.',
    splash_enter:'Enter app', splash_hint:'Tap anywhere, or wait a moment…',
    home_hello:'Hello 👋',
    home_intro:'Scan a QR code and BraillePay will let you feel and hear its pattern — one character at a time — without ever spoiling what it says.',
    nav_scan_title:'Scan QR', nav_scan_sub:'Open the camera and verify a code',
    nav_send_sub:'Demo UPI-style payment (simulated)',
    nav_balance_sub:'Demo balance, recent activity',
    nav_learning_sub:'Interactive Braille trainer',
    nav_viz_sub:'Type anything, feel every cell',
    nav_history_sub:'Search and replay past scans',
    nav_demo_sub:"A cinematic walkthrough — no camera needed",
    nav_settings_title:'Accessibility & Security', nav_settings_sub:'Voice, haptics, lock, contrast',
    nav_about_sub:"Roadmap & what's next",
    scan_sub_default:'Point the camera at a QR code', scan_searching:'Searching for a QR code…',
    scan_cam_placeholder:"Camera hasn't started yet. BraillePay needs camera access to scan — nothing you scan is ever sent anywhere.",
    scan_start_camera:'Start camera', scan_try_no_camera:'Try it without a camera',
    scan_verify_banner:'Simulated verification — no real payment, no bank connection',
    scan_confidence:'Confidence', scan_ready:'Ready',
    scan_caption:"The category is announced and vibrated. The identity itself stays private — that's the point.",
    hold_hint_replay:'Press and hold the cell to keep replaying this pattern',
    speed_slow:'Slow', speed_normal:'Normal', speed_fast:'Fast',
    sum_chars_read:'Characters read', sum_letters:'Letters', sum_digits:'Digits', sum_other:'Spaces / symbols',
    btn_reveal_text:'Show text (sighted demo aid)', btn_replay:'Replay', btn_scan_again:'Scan another',
    learn_sub:'Here identities ARE spoken — this is where you learn them',
    tab_browse:'Browse', tab_quiz:'Practice quiz',
    learn_tap_char:'Tap a character below',
    hold_hint_dot:'Tap a dot on the cell above to replay just that dot',
    level_up:'Level up! 🎉',
    quiz_caption_default:'Feel the pattern (or listen to the vibration), then guess.',
    quiz_replay:'Feel it again', quiz_next:'New pattern',
    viz_sub:'Type anything and feel it, cell by cell', viz_placeholder:'Type a word or phrase…',
    demo_sub:'A cinematic walkthrough of the whole app', demo_idle:'Idle',
    demo_caption_default:'This walks through scanning, learning, and settings automatically — good for showing someone the whole app in one go.',
    demo_start:'Start guided demo', demo_stop:'Stop demo',
    settings_sub:'Every change previews instantly',
    settings_live_preview:'Live preview', settings_live_preview_sub:'Toggling a setting demonstrates it here',
    settings_speech:'Voice announcements', settings_speech_sub:'Speaks category names and prompts aloud',
    settings_haptics:'Haptics / vibration', settings_haptics_sub:'Feel each dot pattern on supported devices',
    settings_intensity:'Vibration intensity',
    settings_contrast:'High-contrast palette', settings_contrast_sub:'Pure black background, maximum contrast',
    settings_motion:'Reduce motion', settings_motion_sub:'Minimizes animation throughout the app',
    settings_hand:'Left-handed layout', settings_hand_sub:'Mirrors controls for left-hand use',
    settings_reveal:'Reveal identities in demo', settings_reveal_sub:'Also speak/show the actual letter or digit — for showing sighted people how it works',
    settings_voice_label:'Voice assistant ("Hey Braille")',
    settings_autolock:'Auto-lock', settings_autolock_sub:'Lock the app after 2 minutes of inactivity',
    settings_language:'Language', settings_language_sub:'Spoken announcements, voice assistant, and the whole interface',
    settings_rate:'Speech rate',
    settings_textsize:'Text size', settings_textsize_sub:'Adjusts screen text (not braille dots)',
    btn_test_vibration:'Test vibration', btn_test_voice:'Test voice', btn_test_braille:'Test Braille playback',
    history_sub:'No account, no money, no data leaves this device', history_search_ph:'Search history…',
    filter_all:'All', filter_verified:'Verified', filter_cancelled:'Cancelled',
    about_h1:'What this is',
    about_p1:'BraillePay is a prototype for verifying the contents of a QR code independently, using sound and vibration instead of sight — built around a real 6-dot Braille cell.',
    about_h2:'What it deliberately withholds',
    about_p2:"During a scan, BraillePay only ever announces whether a character is a letter or a digit — never the letter or digit itself. The full Braille dot pattern is still shown and vibrated out in full, so a Braille-literate user can independently read the actual value themselves.",
    about_h3:'What this is not',
    about_p3:'There is no camera upload, no real UPI or bank linkage, and no real payment anywhere in this app. The verification screen you see during a scan is entirely simulated for demonstration; QR content is decoded on-device and never transmitted.',
    about_h4:'Technology overview',
    tech1_title:'On-device QR decode', tech1_sub:'jsQR, runs fully client-side',
    tech2_title:'Web Speech API', tech2_sub:'Category-only announcements',
    tech3_title:'Vibration API', tech3_sub:'Dot-accurate haptic patterns',
    tech4_title:'Grade-1 Braille engine', tech4_sub:'Real 6-dot pattern table',
    about_h5:'Roadmap',
    road1_b:'Today — Prototype', road1_s:'Camera QR scan, category-only verification, learning mode, visualizer.',
    road2_b:'Next — Grade-2 Braille', road2_s:'Contractions and abbreviations for faster reading.',
    road3_b:'Future — Smartwatch companion', road3_s:"Wrist-tap haptics so verification doesn't need the phone out.",
    road4_b:'Future — Bluetooth Braille wearables', road4_s:'Pairing with dedicated refreshable-Braille or haptic-glove hardware, plus on-device heuristics to flag unusually-shaped codes for extra caution.',
    about_disclaimer:"This is a demo/prototype interface. All history and settings live only in this browser tab's memory and reset on reload. No backend, no UPI, no bank connection.",
    send_sub:'Simulated UPI-style demo — no real transfer, ever',
    send_banner:'Demo payment — no real money moves, no bank or UPI network involved',
    send_upi_label:'UPI ID or mobile number',
    send_recipient:'Recipient', send_upi_id:'UPI ID', send_bank:'Bank', send_status:'Status',
    send_verified_demo:'✓ Verified (demo)', btn_continue:'Continue',
    send_demo_balance:'Demo balance', send_amount_label:'Amount (₹)',
    send_note_label:'Note (optional)', send_note_ph:'For lunch',
    btn_back:'Back', send_amount:'Amount', send_note:'Note', send_fee:'Fee', send_fee_demo:'₹0 (demo)',
    send_confirm_pay:'Confirm & Pay', send_confirm_to_pay:'Confirm to pay',
    btn_confirm_bio:'Confirm with biometrics', btn_use_pin:'Use demo PIN instead',
    send_processing:'Processing your demo payment…',
    send_success_chip:'Payment Successful (Demo)',
    send_txid:'Transaction ID', send_utr:'UTR Number', send_time:'Time', send_remaining_balance:'Remaining balance',
    send_disclaimer:'This is a Demo Transaction. No real money was sent; no bank or UPI network was contacted.',
    btn_share_receipt:'Share receipt', btn_download:'Download', btn_repeat_aloud:'Repeat aloud', btn_return_home:'Return home',
    balance_sub:'Demo account — resets on reload', balance_available:'Available balance (demo)',
    btn_speak_balance:'🔊 Speak balance', balance_recent_activity:'Recent activity',
    balance_empty:'No demo transactions yet — try Send Money.',
    lock_title:'BraillePay is locked',
    lock_pin_hint_pre:'Demo PIN is', lock_pin_hint_post:'— this is a prototype, not a real security boundary.',
    tab_home:'Home', tab_scan_short:'Scan', tab_learn_short:'Learn', tab_history_short:'History', tab_settings_short:'Settings',
    common_back:'Back to home',
    scr_visualize:'Visualizer', scr_demo:'Guided Demo', scr_about:'About',
    quiz_correct:'Correct! ', quiz_not_quite:'Not quite. ', quiz_it_was:'It was ', screen_suffix:' screen',
    scan_title:'Scan QR', learn_title:'Learning Mode', viz_title:'Visualizer', demo_title:'Guided Demo',
    settings_title:'Accessibility', history_title:'Scan History', about_title:'About',
    send_title:'Send Money', balance_title:'Balance & Transactions',
    voice_label:'Voice', voice_lang_label:'Voice language',
    voice_unavailable_full:'No matching voice was found for this language on this device — using the browser\'s default voice instead, which may not sound correct. You can install or enable more voices in your device\'s text-to-speech settings.',
    learning_stop:'Stop automatic learning', learning_start:'Start automatic lesson',
    learning_hey_braille_hint:'Say: "Hey Braille, vibrate B"',
    learning_complete_title:'Lesson complete.', learning_complete_sub:'You learned A to Z and 0 to 9.', learning_repeat:'Repeat Lesson',
    learning_intro_speech:'Let\'s learn Braille. Starting with A.',
    learning_complete_speech:'Lesson complete. You learned A to Z and 0 to 9.',
    learning_unsupported_speech:'I can teach letters A to Z and numbers 0 to 9.',
    learning_progress_prefix:'Lesson progress'
  },
  hi: {
    letter:'अक्षर', digit:'अंक', space:'स्पेस', symbol:'चिह्न',
    listening_wake:'"हे ब्रेल" सुन रहा है…', listening_cmd:'आदेश सुन रहा है…',
    voice_on:'वॉइस असिस्टेंट चालू है। "हे ब्रेल" कहें, फिर एक आदेश दें।',
    voice_default:'वेक फ्रेज़ बोलें, फिर एक आदेश दें, जैसे "स्कैन क्यूआर" या "बैलेंस चेक करो"',
    mic_denied:'माइक्रोफ़ोन अनुमति अस्वीकृत — वॉइस असिस्टेंट बंद है।',
    unsupported:'इस ब्राउज़र में वॉइस कंट्रोल समर्थित नहीं है।',
    unlocked:'अनलॉक हो गया', locked_idle:'निष्क्रियता के कारण लॉक हो गया, आपकी सुरक्षा के लिए',
    wrong_pin:'गलत पिन। डेमो पिन 1234 है — फिर से कोशिश करें।',
    lock_caption_bio:'अपने डिवाइस के बायोमेट्रिक्स से अनलॉक करें, या डेमो पिन का उपयोग करें।',
    lock_caption_nobio:'इस डिवाइस या ब्राउज़र पर बायोमेट्रिक प्रमाणीकरण उपलब्ध नहीं है — इसके बजाय डेमो पिन डालें।',
    verifying_bio:'आपकी फिंगरप्रिंट या फेस की प्रतीक्षा कर रहे हैं…',
    bio_mismatch:'बायोमेट्रिक जांच मेल नहीं खाई। फिर से कोशिश करें, या नीचे अपना पिन उपयोग करें।',
    send_confirm:'अपने डिवाइस के बायोमेट्रिक प्रॉम्प्ट का उपयोग करें, या डेमो पिन (1234) डालें।',
    send_wrong_pin:'डेमो पिन 1234 है — फिर से कोशिश करें।',
    opening:'खोल रहा है ', unlock_first:'पहले BraillePay अनलॉक करें',
    balance_speak:'आपका डेमो बैलेंस है ₹', payment_success:'भुगतान सफल हुआ। ',
    scr_home:'होम', scr_scan:'स्कैन क्यूआर', scr_send:'पैसे भेजें', scr_balance:'बैलेंस',
    scr_settings:'सेटिंग्स', scr_learning:'लर्निंग मोड', scr_history:'इतिहास',

    skip_link:'मुख्य सामग्री पर जाएं',
    splash_tag:'एक दृष्टिहीन-अनुकूल तरीका जिससे आप बिना जवाब बताए, ध्वनि और स्पर्श के ज़रिए यह जान सकते हैं कि एक क्यूआर कोड में क्या लिखा है।',
    splash_enter:'ऐप खोलें', splash_hint:'कहीं भी टैप करें, या थोड़ा इंतज़ार करें…',
    home_hello:'नमस्ते 👋',
    home_intro:'एक क्यूआर कोड स्कैन करें और BraillePay आपको उसका पैटर्न महसूस और सुनने देगा — एक बार में एक अक्षर — बिना यह बताए कि उसमें क्या लिखा है।',
    nav_scan_title:'क्यूआर स्कैन करें', nav_scan_sub:'कैमरा खोलें और कोड सत्यापित करें',
    nav_send_sub:'डेमो UPI-स्टाइल भुगतान (सिम्युलेटेड)',
    nav_balance_sub:'डेमो बैलेंस, हाल की गतिविधि',
    nav_learning_sub:'इंटरएक्टिव ब्रेल ट्रेनर',
    nav_viz_sub:'कुछ भी टाइप करें, हर सेल महसूस करें',
    nav_history_sub:'पिछले स्कैन खोजें और फिर से चलाएं',
    nav_demo_sub:'एक सिनेमाई वॉकथ्रू — कैमरे की ज़रूरत नहीं',
    nav_settings_title:'एक्सेसिबिलिटी और सुरक्षा', nav_settings_sub:'आवाज़, हैप्टिक्स, लॉक, कंट्रास्ट',
    nav_about_sub:'रोडमैप और आगे क्या है',
    scan_sub_default:'कैमरे को क्यूआर कोड पर पॉइंट करें', scan_searching:'क्यूआर कोड खोजा जा रहा है…',
    scan_cam_placeholder:'कैमरा अभी शुरू नहीं हुआ है। स्कैन करने के लिए BraillePay को कैमरा एक्सेस चाहिए — आप जो भी स्कैन करते हैं वह कभी कहीं नहीं भेजा जाता।',
    scan_start_camera:'कैमरा शुरू करें', scan_try_no_camera:'बिना कैमरे के आज़माएं',
    scan_verify_banner:'सिम्युलेटेड सत्यापन — कोई वास्तविक भुगतान नहीं, कोई बैंक कनेक्शन नहीं',
    scan_confidence:'विश्वास स्तर', scan_ready:'तैयार',
    scan_caption:'केवल श्रेणी बताई और वाइब्रेट की जाती है। असली पहचान गुप्त रहती है — यही तो मकसद है।',
    hold_hint_replay:'इस पैटर्न को बार-बार चलाने के लिए सेल को दबाकर रखें',
    speed_slow:'धीमा', speed_normal:'सामान्य', speed_fast:'तेज़',
    sum_chars_read:'पढ़े गए अक्षर', sum_letters:'अक्षर', sum_digits:'अंक', sum_other:'स्पेस / चिह्न',
    btn_reveal_text:'टेक्स्ट दिखाएं (दृष्टि वालों के लिए डेमो सहायता)', btn_replay:'फिर से चलाएं', btn_scan_again:'एक और स्कैन करें',
    learn_sub:'यहां पहचान बोली जाती है — यहीं आप उन्हें सीखते हैं',
    tab_browse:'ब्राउज़ करें', tab_quiz:'अभ्यास क्विज़',
    learn_tap_char:'नीचे किसी अक्षर पर टैप करें',
    hold_hint_dot:'ऊपर सेल पर किसी डॉट को टैप करें ताकि केवल वह डॉट फिर से चले',
    level_up:'लेवल अप! 🎉',
    quiz_caption_default:'पैटर्न महसूस करें (या वाइब्रेशन सुनें), फिर अनुमान लगाएं।',
    quiz_replay:'इसे फिर महसूस करें', quiz_next:'नया पैटर्न',
    viz_sub:'कुछ भी टाइप करें और उसे सेल दर सेल महसूस करें', viz_placeholder:'एक शब्द या वाक्यांश टाइप करें…',
    demo_sub:'पूरे ऐप का एक सिनेमाई वॉकथ्रू', demo_idle:'निष्क्रिय',
    demo_caption_default:'यह अपने आप स्कैनिंग, लर्निंग और सेटिंग्स के बारे में बताता है — किसी को पूरा ऐप एक बार में दिखाने के लिए अच्छा है।',
    demo_start:'गाइडेड डेमो शुरू करें', demo_stop:'डेमो रोकें',
    settings_sub:'हर बदलाव तुरंत दिखता है',
    settings_live_preview:'लाइव प्रीव्यू', settings_live_preview_sub:'सेटिंग बदलने पर यह यहां दिखेगा',
    settings_speech:'आवाज़ की घोषणाएं', settings_speech_sub:'श्रेणी के नाम और संकेत ज़ोर से बोलता है',
    settings_haptics:'हैप्टिक्स / वाइब्रेशन', settings_haptics_sub:'समर्थित डिवाइस पर हर डॉट पैटर्न महसूस करें',
    settings_intensity:'वाइब्रेशन तीव्रता',
    settings_contrast:'हाई-कंट्रास्ट पैलेट', settings_contrast_sub:'शुद्ध काला बैकग्राउंड, अधिकतम कंट्रास्ट',
    settings_motion:'गति कम करें', settings_motion_sub:'पूरे ऐप में एनिमेशन कम करता है',
    settings_hand:'बाएं हाथ के लिए लेआउट', settings_hand_sub:'बाएं हाथ के उपयोग के लिए नियंत्रण बदलता है',
    settings_reveal:'डेमो में पहचान दिखाएं', settings_reveal_sub:'असली अक्षर या अंक भी बोलें/दिखाएं — दृष्टि वालों को यह दिखाने के लिए कि यह कैसे काम करता है',
    settings_voice_label:'वॉइस असिस्टेंट ("हे ब्रेल")',
    settings_autolock:'ऑटो-लॉक', settings_autolock_sub:'2 मिनट की निष्क्रियता के बाद ऐप को लॉक करें',
    settings_language:'भाषा', settings_language_sub:'बोली जाने वाली घोषणाएं, वॉइस असिस्टेंट, और पूरा इंटरफ़ेस',
    settings_rate:'बोलने की गति',
    settings_textsize:'टेक्स्ट का आकार', settings_textsize_sub:'स्क्रीन टेक्स्ट को समायोजित करता है (ब्रेल डॉट्स नहीं)',
    btn_test_vibration:'वाइब्रेशन जांचें', btn_test_voice:'आवाज़ जांचें', btn_test_braille:'ब्रेल प्लेबैक जांचें',
    history_sub:'कोई खाता नहीं, कोई पैसा नहीं, कोई डेटा इस डिवाइस से बाहर नहीं जाता', history_search_ph:'इतिहास खोजें…',
    filter_all:'सभी', filter_verified:'सत्यापित', filter_cancelled:'रद्द',
    about_h1:'यह क्या है',
    about_p1:'BraillePay एक प्रोटोटाइप है जो दृष्टि के बजाय ध्वनि और वाइब्रेशन का उपयोग करके, स्वतंत्र रूप से एक क्यूआर कोड की सामग्री को सत्यापित करने के लिए है — यह एक वास्तविक 6-डॉट ब्रेल सेल के आसपास बनाया गया है।',
    about_h2:'यह जानबूझकर क्या नहीं बताता',
    about_p2:'स्कैन के दौरान, BraillePay केवल यह बताता है कि कोई अक्षर है या अंक — कभी भी असली अक्षर या अंक नहीं। पूरा ब्रेल डॉट पैटर्न फिर भी पूरी तरह दिखाया और वाइब्रेट किया जाता है, ताकि ब्रेल जानने वाला उपयोगकर्ता स्वयं असली मान पढ़ सके।',
    about_h3:'यह क्या नहीं है',
    about_p3:'इस ऐप में कोई कैमरा अपलोड नहीं, कोई असली UPI या बैंक लिंक नहीं, और कहीं भी कोई असली भुगतान नहीं है। स्कैन के दौरान दिखने वाली सत्यापन स्क्रीन प्रदर्शन के लिए पूरी तरह सिम्युलेटेड है; क्यूआर सामग्री डिवाइस पर ही डिकोड होती है और कभी भेजी नहीं जाती।',
    about_h4:'तकनीक अवलोकन',
    tech1_title:'डिवाइस पर क्यूआर डिकोड', tech1_sub:'jsQR, पूरी तरह क्लाइंट-साइड चलता है',
    tech2_title:'वेब स्पीच एपीआई', tech2_sub:'केवल श्रेणी की घोषणाएं',
    tech3_title:'वाइब्रेशन एपीआई', tech3_sub:'डॉट-सटीक हैप्टिक पैटर्न',
    tech4_title:'ग्रेड-1 ब्रेल इंजन', tech4_sub:'वास्तविक 6-डॉट पैटर्न तालिका',
    about_h5:'रोडमैप',
    road1_b:'आज — प्रोटोटाइप', road1_s:'कैमरा क्यूआर स्कैन, केवल श्रेणी सत्यापन, लर्निंग मोड, विज़ुअलाइज़र।',
    road2_b:'अगला — ग्रेड-2 ब्रेल', road2_s:'तेज़ी से पढ़ने के लिए संकुचन और संक्षिप्ताक्षर।',
    road3_b:'भविष्य — स्मार्टवॉच साथी', road3_s:'कलाई-टैप हैप्टिक्स ताकि फोन निकालने की ज़रूरत न पड़े।',
    road4_b:'भविष्य — ब्लूटूथ ब्रेल वियरेबल्स', road4_s:'समर्पित रिफ्रेशेबल-ब्रेल या हैप्टिक-ग्लव हार्डवेयर के साथ पेयरिंग, साथ ही असामान्य आकार के कोड को चिह्नित करने के लिए ऑन-डिवाइस हेयुरिस्टिक्स।',
    about_disclaimer:'यह एक डेमो/प्रोटोटाइप इंटरफ़ेस है। सारा इतिहास और सेटिंग्स केवल इस ब्राउज़र टैब की मेमोरी में रहती हैं और रीलोड पर रीसेट हो जाती हैं। कोई बैकएंड नहीं, कोई UPI नहीं, कोई बैंक कनेक्शन नहीं।',
    send_sub:'सिम्युलेटेड UPI-स्टाइल डेमो — कभी कोई असली ट्रांसफर नहीं',
    send_banner:'डेमो भुगतान — कोई असली पैसा नहीं चलता, कोई बैंक या UPI नेटवर्क शामिल नहीं',
    send_upi_label:'UPI आईडी या मोबाइल नंबर',
    send_recipient:'प्राप्तकर्ता', send_upi_id:'UPI आईडी', send_bank:'बैंक', send_status:'स्थिति',
    send_verified_demo:'✓ सत्यापित (डेमो)', btn_continue:'जारी रखें',
    send_demo_balance:'डेमो बैलेंस', send_amount_label:'राशि (₹)',
    send_note_label:'नोट (वैकल्पिक)', send_note_ph:'लंच के लिए',
    btn_back:'वापस', send_amount:'राशि', send_note:'नोट', send_fee:'शुल्क', send_fee_demo:'₹0 (डेमो)',
    send_confirm_pay:'पुष्टि करें और भुगतान करें', send_confirm_to_pay:'भुगतान की पुष्टि करें',
    btn_confirm_bio:'बायोमेट्रिक्स से पुष्टि करें', btn_use_pin:'इसके बजाय डेमो पिन का उपयोग करें',
    send_processing:'आपका डेमो भुगतान प्रोसेस हो रहा है…',
    send_success_chip:'भुगतान सफल (डेमो)',
    send_txid:'लेनदेन आईडी', send_utr:'UTR नंबर', send_time:'समय', send_remaining_balance:'शेष बैलेंस',
    send_disclaimer:'यह एक डेमो लेनदेन है। कोई असली पैसा नहीं भेजा गया; किसी बैंक या UPI नेटवर्क से संपर्क नहीं किया गया।',
    btn_share_receipt:'रसीद साझा करें', btn_download:'डाउनलोड करें', btn_repeat_aloud:'ज़ोर से दोहराएं', btn_return_home:'होम पर वापस जाएं',
    balance_sub:'डेमो खाता — रीलोड पर रीसेट होता है', balance_available:'उपलब्ध बैलेंस (डेमो)',
    btn_speak_balance:'🔊 बैलेंस बोलें', balance_recent_activity:'हाल की गतिविधि',
    balance_empty:'अभी तक कोई डेमो लेनदेन नहीं — पैसे भेजें आज़माएं।',
    lock_title:'BraillePay लॉक है',
    lock_pin_hint_pre:'डेमो पिन है', lock_pin_hint_post:'— यह एक प्रोटोटाइप है, कोई वास्तविक सुरक्षा सीमा नहीं।',
    tab_home:'होम', tab_scan_short:'स्कैन', tab_learn_short:'सीखें', tab_history_short:'इतिहास', tab_settings_short:'सेटिंग्स',
    common_back:'होम पर वापस जाएं',
    scr_visualize:'विज़ुअलाइज़र', scr_demo:'गाइडेड डेमो', scr_about:'परिचय',
    quiz_correct:'सही! ', quiz_not_quite:'गलत। ', quiz_it_was:'यह था ', screen_suffix:' स्क्रीन',
    scan_title:'क्यूआर स्कैन करें', learn_title:'लर्निंग मोड', viz_title:'विज़ुअलाइज़र', demo_title:'गाइडेड डेमो',
    settings_title:'एक्सेसिबिलिटी', history_title:'स्कैन इतिहास', about_title:'परिचय',
    send_title:'पैसे भेजें', balance_title:'बैलेंस और लेनदेन',
    voice_label:'आवाज़', voice_lang_label:'आवाज़ की भाषा',
    voice_unavailable_full:'हिंदी आवाज़ इस डिवाइस पर उपलब्ध नहीं है। कृपया अपने डिवाइस की टेक्स्ट-टू-स्पीच सेटिंग में हिंदी आवाज़ इंस्टॉल या सक्षम करें।',
    learning_stop:'ऑटोमैटिक लर्निंग रोकें', learning_start:'ऑटोमैटिक पाठ शुरू करें',
    learning_hey_braille_hint:'कहें: "हे ब्रेल, वाइब्रेट बी"',
    learning_complete_title:'पाठ पूरा हुआ।', learning_complete_sub:'आपने A से Z और 0 से 9 सीख लिया।', learning_repeat:'पाठ दोहराएं',
    learning_intro_speech:'चलिए ब्रेल सीखते हैं। A से शुरू करते हैं।',
    learning_complete_speech:'पाठ पूरा हुआ। आपने A से Z और 0 से 9 सीख लिया।',
    learning_unsupported_speech:'मैं A से Z तक अक्षर और 0 से 9 तक अंक सिखा सकता हूं।',
    learning_progress_prefix:'पाठ प्रगति'
  },
  mr: {
    letter:'अक्षर', digit:'अंक', space:'स्पेस', symbol:'चिन्ह',
    listening_wake:'"हे ब्रेल" ऐकत आहे…', listening_cmd:'आदेश ऐकत आहे…',
    voice_on:'व्हॉइस असिस्टंट सुरू आहे. "हे ब्रेल" म्हणा, नंतर आदेश द्या.',
    voice_default:'वेक फ्रेज म्हणा, नंतर आदेश द्या, जसे "स्कॅन क्यूआर" किंवा "बॅलन्स तपासा"',
    mic_denied:'मायक्रोफोन परवानगी नाकारली — व्हॉइस असिस्टंट बंद आहे.',
    unsupported:'या ब्राउझरमध्ये व्हॉइस कंट्रोल समर्थित नाही.',
    unlocked:'अनलॉक झाले', locked_idle:'निष्क्रियतेमुळे लॉक झाले, तुमच्या सुरक्षिततेसाठी',
    wrong_pin:'चुकीचा पिन. डेमो पिन 1234 आहे — पुन्हा प्रयत्न करा.',
    lock_caption_bio:'तुमच्या डिव्हाइसच्या बायोमेट्रिक्सने अनलॉक करा, किंवा डेमो पिन वापरा.',
    lock_caption_nobio:'या डिव्हाइस किंवा ब्राउझरवर बायोमेट्रिक प्रमाणीकरण उपलब्ध नाही — त्याऐवजी डेमो पिन टाका.',
    verifying_bio:'तुमच्या फिंगरप्रिंट किंवा फेसची वाट पाहत आहे…',
    bio_mismatch:'बायोमेट्रिक तपासणी जुळली नाही. पुन्हा प्रयत्न करा, किंवा खालील पिन वापरा.',
    send_confirm:'तुमच्या डिव्हाइसचा बायोमेट्रिक प्रॉम्प्ट वापरा, किंवा डेमो पिन (1234) टाका.',
    send_wrong_pin:'डेमो पिन 1234 आहे — पुन्हा प्रयत्न करा.',
    opening:'उघडत आहे ', unlock_first:'आधी BraillePay अनलॉक करा',
    balance_speak:'तुमची डेमो शिल्लक आहे ₹', payment_success:'पेमेंट यशस्वी झाले. ',
    scr_home:'होम', scr_scan:'क्यूआर स्कॅन करा', scr_send:'पैसे पाठवा', scr_balance:'बॅलन्स',
    scr_settings:'सेटिंग्ज', scr_learning:'लर्निंग मोड', scr_history:'इतिहास',

    skip_link:'मुख्य मजकुराकडे जा',
    splash_tag:'एक दृष्टिहीन-अनुकूल पद्धत, ज्याद्वारे तुम्ही उत्तर न सांगता, आवाज आणि स्पर्शाद्वारे क्यूआर कोडमध्ये काय लिहिले आहे हे जाणून घेऊ शकता.',
    splash_enter:'अ‍ॅप उघडा', splash_hint:'कुठेही टॅप करा, किंवा थोडी वाट पाहा…',
    home_hello:'नमस्कार 👋',
    home_intro:'एक क्यूआर कोड स्कॅन करा आणि BraillePay तुम्हाला त्याचा नमुना जाणवू आणि ऐकू देईल — एका वेळी एक अक्षर — त्यात काय लिहिले आहे हे न सांगता.',
    nav_scan_title:'क्यूआर स्कॅन करा', nav_scan_sub:'कॅमेरा उघडा आणि कोड सत्यापित करा',
    nav_send_sub:'डेमो UPI-शैलीतील पेमेंट (सिम्युलेटेड)',
    nav_balance_sub:'डेमो बॅलन्स, अलीकडील क्रियाकलाप',
    nav_learning_sub:'इंटरॅक्टिव्ह ब्रेल ट्रेनर',
    nav_viz_sub:'काहीही टाइप करा, प्रत्येक सेल अनुभवा',
    nav_history_sub:'मागील स्कॅन शोधा आणि पुन्हा प्ले करा',
    nav_demo_sub:'एक सिनेमॅटिक वॉकथ्रू — कॅमेराची गरज नाही',
    nav_settings_title:'प्रवेशयोग्यता आणि सुरक्षा', nav_settings_sub:'आवाज, हॅप्टिक्स, लॉक, कॉन्ट्रास्ट',
    nav_about_sub:'रोडमॅप आणि पुढे काय आहे',
    scan_sub_default:'कॅमेरा क्यूआर कोडवर रोखा', scan_searching:'क्यूआर कोड शोधत आहे…',
    scan_cam_placeholder:'कॅमेरा अजून सुरू झालेला नाही. स्कॅन करण्यासाठी BraillePay ला कॅमेरा प्रवेश हवा — तुम्ही जे स्कॅन करता ते कधीही कुठेही पाठवले जात नाही.',
    scan_start_camera:'कॅमेरा सुरू करा', scan_try_no_camera:'कॅमेराशिवाय वापरून पाहा',
    scan_verify_banner:'सिम्युलेटेड पडताळणी — कोणतेही खरे पेमेंट नाही, बँक कनेक्शन नाही',
    scan_confidence:'विश्वास पातळी', scan_ready:'तयार',
    scan_caption:'फक्त श्रेणी सांगितली आणि व्हायब्रेट केली जाते. खरी ओळख गुप्त राहते — हाच तर उद्देश आहे.',
    hold_hint_replay:'हा नमुना पुन्हा पुन्हा प्ले करण्यासाठी सेल दाबून ठेवा',
    speed_slow:'मंद', speed_normal:'सामान्य', speed_fast:'वेगवान',
    sum_chars_read:'वाचलेली अक्षरे', sum_letters:'अक्षरे', sum_digits:'अंक', sum_other:'स्पेस / चिन्हे',
    btn_reveal_text:'मजकूर दाखवा (दृष्टी असलेल्यांसाठी डेमो मदत)', btn_replay:'पुन्हा प्ले करा', btn_scan_again:'आणखी एक स्कॅन करा',
    learn_sub:'इथे ओळख बोलली जाते — इथेच तुम्ही त्या शिकता',
    tab_browse:'ब्राउझ करा', tab_quiz:'सराव प्रश्नमंजुषा',
    learn_tap_char:'खाली एखाद्या अक्षरावर टॅप करा',
    hold_hint_dot:'वरील सेलवरील एखाद्या ठिपक्यावर टॅप करा जेणेकरून फक्त तो ठिपका पुन्हा प्ले होईल',
    level_up:'लेवल अप! 🎉',
    quiz_caption_default:'नमुना अनुभवा (किंवा व्हायब्रेशन ऐका), नंतर अंदाज लावा.',
    quiz_replay:'पुन्हा अनुभवा', quiz_next:'नवीन नमुना',
    viz_sub:'काहीही टाइप करा आणि ते सेल-दर-सेल अनुभवा', viz_placeholder:'एक शब्द किंवा वाक्यांश टाइप करा…',
    demo_sub:'संपूर्ण अ‍ॅपचा सिनेमॅटिक वॉकथ्रू', demo_idle:'निष्क्रिय',
    demo_caption_default:'हे आपोआप स्कॅनिंग, लर्निंग आणि सेटिंग्जमधून फिरते — कोणाला संपूर्ण अ‍ॅप एका वेळी दाखवण्यासाठी उत्तम.',
    demo_start:'गाइडेड डेमो सुरू करा', demo_stop:'डेमो थांबवा',
    settings_sub:'प्रत्येक बदल त्वरित दिसतो',
    settings_live_preview:'लाइव्ह प्रिव्ह्यू', settings_live_preview_sub:'सेटिंग बदलल्यावर ते इथे दिसेल',
    settings_speech:'आवाजाच्या घोषणा', settings_speech_sub:'श्रेणीची नावे आणि सूचना मोठ्याने बोलतो',
    settings_haptics:'हॅप्टिक्स / व्हायब्रेशन', settings_haptics_sub:'समर्थित डिव्हाइसवर प्रत्येक ठिपका नमुना अनुभवा',
    settings_intensity:'व्हायब्रेशन तीव्रता',
    settings_contrast:'हाय-कॉन्ट्रास्ट पॅलेट', settings_contrast_sub:'शुद्ध काळी पार्श्वभूमी, कमाल कॉन्ट्रास्ट',
    settings_motion:'हालचाल कमी करा', settings_motion_sub:'संपूर्ण अ‍ॅपमध्ये अ‍ॅनिमेशन कमी करते',
    settings_hand:'डाव्या हाताचा लेआउट', settings_hand_sub:'डाव्या हाताच्या वापरासाठी नियंत्रणे आरशासारखी करतो',
    settings_reveal:'डेमोमध्ये ओळख दाखवा', settings_reveal_sub:'खरे अक्षर किंवा अंक देखील बोला/दाखवा — दृष्टी असलेल्यांना हे कसे कार्य करते हे दाखवण्यासाठी',
    settings_voice_label:'व्हॉइस असिस्टंट ("हे ब्रेल")',
    settings_autolock:'ऑटो-लॉक', settings_autolock_sub:'2 मिनिटांच्या निष्क्रियतेनंतर अ‍ॅप लॉक करा',
    settings_language:'भाषा', settings_language_sub:'बोलल्या जाणाऱ्या घोषणा, व्हॉइस असिस्टंट, आणि संपूर्ण इंटरफेस',
    settings_rate:'बोलण्याचा वेग',
    settings_textsize:'मजकूराचा आकार', settings_textsize_sub:'स्क्रीन मजकूर समायोजित करतो (ब्रेल ठिपके नाही)',
    btn_test_vibration:'व्हायब्रेशन तपासा', btn_test_voice:'आवाज तपासा', btn_test_braille:'ब्रेल प्लेबॅक तपासा',
    history_sub:'कोणतेही खाते नाही, पैसे नाहीत, कोणताही डेटा या डिव्हाइसमधून बाहेर जात नाही', history_search_ph:'इतिहास शोधा…',
    filter_all:'सर्व', filter_verified:'सत्यापित', filter_cancelled:'रद्द',
    about_h1:'हे काय आहे',
    about_p1:'BraillePay हे दृष्टीऐवजी आवाज आणि व्हायब्रेशन वापरून, स्वतंत्रपणे क्यूआर कोडमधील मजकूर पडताळण्यासाठी एक प्रोटोटाइप आहे — हे खऱ्या 6-ठिपक्यांच्या ब्रेल सेलभोवती तयार केले आहे.',
    about_h2:'हे मुद्दाम काय लपवते',
    about_p2:'स्कॅन दरम्यान, BraillePay फक्त हे सांगते की एखादे अक्षर आहे की अंक — कधीही खरे अक्षर किंवा अंक नाही. संपूर्ण ब्रेल ठिपका नमुना तरीही पूर्णपणे दाखवला आणि व्हायब्रेट केला जातो, जेणेकरून ब्रेल जाणणारा वापरकर्ता स्वतः खरे मूल्य वाचू शकेल.',
    about_h3:'हे काय नाही',
    about_p3:'या अ‍ॅपमध्ये कोणतेही कॅमेरा अपलोड नाही, कोणतेही खरे UPI किंवा बँक लिंक नाही, आणि कुठेही कोणतेही खरे पेमेंट नाही. स्कॅन दरम्यान दिसणारी पडताळणी स्क्रीन प्रात्यक्षिकासाठी पूर्णपणे सिम्युलेटेड आहे; क्यूआर मजकूर डिव्हाइसवरच डीकोड होतो आणि कधीही पाठवला जात नाही.',
    about_h4:'तंत्रज्ञान आढावा',
    tech1_title:'डिव्हाइसवर क्यूआर डीकोड', tech1_sub:'jsQR, पूर्णपणे क्लायंट-साइड चालते',
    tech2_title:'वेब स्पीच एपीआय', tech2_sub:'फक्त श्रेणीच्या घोषणा',
    tech3_title:'व्हायब्रेशन एपीआय', tech3_sub:'ठिपका-अचूक हॅप्टिक नमुने',
    tech4_title:'ग्रेड-1 ब्रेल इंजिन', tech4_sub:'खरी 6-ठिपका नमुना सारणी',
    about_h5:'रोडमॅप',
    road1_b:'आज — प्रोटोटाइप', road1_s:'कॅमेरा क्यूआर स्कॅन, फक्त श्रेणी पडताळणी, लर्निंग मोड, व्हिज्युअलायझर.',
    road2_b:'पुढे — ग्रेड-2 ब्रेल', road2_s:'जलद वाचनासाठी संकुचन आणि संक्षेप.',
    road3_b:'भविष्य — स्मार्टवॉच साथी', road3_s:'मनगट-टॅप हॅप्टिक्स जेणेकरून फोन बाहेर काढण्याची गरज नाही.',
    road4_b:'भविष्य — ब्लूटूथ ब्रेल परिधान करण्यायोग्य उपकरणे', road4_s:'समर्पित रिफ्रेशेबल-ब्रेल किंवा हॅप्टिक-ग्लोव्ह हार्डवेअरसह जोडणी, तसेच असामान्य आकाराचे कोड चिन्हांकित करण्यासाठी ऑन-डिव्हाइस हेयुरिस्टिक्स.',
    about_disclaimer:'हा एक डेमो/प्रोटोटाइप इंटरफेस आहे. सर्व इतिहास आणि सेटिंग्ज फक्त या ब्राउझर टॅबच्या मेमरीत राहतात आणि रीलोडवर रीसेट होतात. कोणताही बॅकएंड नाही, UPI नाही, बँक कनेक्शन नाही.',
    send_sub:'सिम्युलेटेड UPI-शैली डेमो — कधीही खरे हस्तांतरण नाही',
    send_banner:'डेमो पेमेंट — कोणतेही खरे पैसे हलत नाहीत, कोणतेही बँक किंवा UPI नेटवर्क सामील नाही',
    send_upi_label:'UPI आयडी किंवा मोबाइल क्रमांक',
    send_recipient:'प्राप्तकर्ता', send_upi_id:'UPI आयडी', send_bank:'बँक', send_status:'स्थिती',
    send_verified_demo:'✓ सत्यापित (डेमो)', btn_continue:'सुरू ठेवा',
    send_demo_balance:'डेमो बॅलन्स', send_amount_label:'रक्कम (₹)',
    send_note_label:'टीप (ऐच्छिक)', send_note_ph:'जेवणासाठी',
    btn_back:'मागे', send_amount:'रक्कम', send_note:'टीप', send_fee:'शुल्क', send_fee_demo:'₹0 (डेमो)',
    send_confirm_pay:'पुष्टी करा आणि पैसे द्या', send_confirm_to_pay:'पैसे देण्याची पुष्टी करा',
    btn_confirm_bio:'बायोमेट्रिक्सने पुष्टी करा', btn_use_pin:'त्याऐवजी डेमो पिन वापरा',
    send_processing:'तुमचे डेमो पेमेंट प्रक्रिया होत आहे…',
    send_success_chip:'पेमेंट यशस्वी (डेमो)',
    send_txid:'व्यवहार आयडी', send_utr:'UTR क्रमांक', send_time:'वेळ', send_remaining_balance:'उर्वरित बॅलन्स',
    send_disclaimer:'हा एक डेमो व्यवहार आहे. कोणतेही खरे पैसे पाठवले गेले नाहीत; कोणत्याही बँक किंवा UPI नेटवर्कशी संपर्क साधला गेला नाही.',
    btn_share_receipt:'पावती शेअर करा', btn_download:'डाउनलोड करा', btn_repeat_aloud:'मोठ्याने पुन्हा सांगा', btn_return_home:'होमवर परत जा',
    balance_sub:'डेमो खाते — रीलोडवर रीसेट होते', balance_available:'उपलब्ध बॅलन्स (डेमो)',
    btn_speak_balance:'🔊 बॅलन्स बोला', balance_recent_activity:'अलीकडील क्रियाकलाप',
    balance_empty:'अजून कोणतेही डेमो व्यवहार नाहीत — पैसे पाठवा वापरून पाहा.',
    lock_title:'BraillePay लॉक आहे',
    lock_pin_hint_pre:'डेमो पिन आहे', lock_pin_hint_post:'— हा एक प्रोटोटाइप आहे, खरी सुरक्षा सीमा नाही.',
    tab_home:'होम', tab_scan_short:'स्कॅन', tab_learn_short:'शिका', tab_history_short:'इतिहास', tab_settings_short:'सेटिंग्ज',
    common_back:'होमवर परत जा',
    scr_visualize:'व्हिज्युअलायझर', scr_demo:'गाइडेड डेमो', scr_about:'माहिती',
    quiz_correct:'बरोबर! ', quiz_not_quite:'चुकले. ', quiz_it_was:'हे होते ', screen_suffix:' स्क्रीन',
    scan_title:'क्यूआर स्कॅन करा', learn_title:'लर्निंग मोड', viz_title:'व्हिज्युअलायझर', demo_title:'गाइडेड डेमो',
    settings_title:'प्रवेशयोग्यता', history_title:'स्कॅन इतिहास', about_title:'माहिती',
    send_title:'पैसे पाठवा', balance_title:'बॅलन्स आणि व्यवहार',
    voice_label:'आवाज', voice_lang_label:'आवाजाची भाषा',
    voice_unavailable_full:'मराठी आवाज या डिव्हाइसवर उपलब्ध नाही. कृपया तुमच्या डिव्हाइसच्या मजकूर-ते-भाषण सेटिंग्जमध्ये मराठी आवाज इंस्टॉल किंवा सक्षम करा.',
    learning_stop:'स्वयंचलित शिकणे थांबवा', learning_start:'स्वयंचलित धडा सुरू करा',
    learning_hey_braille_hint:'म्हणा: "हे ब्रेल, वायब्रेट बी"',
    learning_complete_title:'धडा पूर्ण झाला.', learning_complete_sub:'तुम्ही A ते Z आणि 0 ते 9 शिकलात.', learning_repeat:'धडा पुन्हा करा',
    learning_intro_speech:'चला ब्रेल शिकूया. A पासून सुरुवात करूया.',
    learning_complete_speech:'धडा पूर्ण झाला. तुम्ही A ते Z आणि 0 ते 9 शिकलात.',
    learning_unsupported_speech:'मी A ते Z अक्षरे आणि 0 ते 9 अंक शिकवू शकतो.',
    learning_progress_prefix:'धडा प्रगती'
  }
};
function t(key){ const lang = (typeof state !== 'undefined' && state.language) || 'en'; return (LANG[lang] && LANG[lang][key]) || LANG.en[key] || key; }
function speechLangCode(){ const lang = (typeof state !== 'undefined' && state.language) || 'en'; return lang==='hi' ? 'hi-IN' : lang==='mr' ? 'mr-IN' : 'en-IN'; }

/* ============================================================
   VOICE MANAGER — picks a real Hindi/Marathi/English speech
   synthesis VOICE, not just a `lang` hint. `.lang` alone is
   frequently ignored by the engine's voice-selection heuristics
   (this is exactly why Hindi/Marathi text was being read in an
   English voice before this fix) — assigning `utterance.voice`
   explicitly is what actually changes the pronunciation.

   Selection priority:
     Hindi/Marathi: exact "xx-IN" -> any "xx-*" -> bare "xx" ->
                    otherwise return null (never silently borrow
                    an unrelated-language voice and pretend it's
                    correct).
     English:       exact "en-IN" -> any "en-*" -> the engine's
                    marked default voice (English almost always
                    has a real match, so a broader fallback here
                    is safe and matches the product's own spec).
   ============================================================ */
let cachedVoices = [];
function logVoiceDiagnostics(){
  if(!cachedVoices.length){ console.log('[BraillePay voices] No voices loaded yet.'); return; }
  console.log('[BraillePay voices] '+cachedVoices.length+' voice(s) available:');
  try{ console.table(cachedVoices.map(v=>({ name:v.name, lang:v.lang, default:v.default }))); }
  catch(e){ cachedVoices.forEach(v=>console.log(v.name, v.lang, 'default:', v.default)); }
}
function refreshVoiceCache(){
  try{ cachedVoices = (window.speechSynthesis && speechSynthesis.getVoices()) || []; }catch(e){ cachedVoices = []; }
  logVoiceDiagnostics();
  updateVoiceStatusUI();
}
function getBestSpeechVoice(languageCode){
  // Deliberately does NOT trigger a cache refresh itself — refreshVoiceCache() calls back into
  // updateVoiceStatusUI() -> getBestSpeechVoice(), so doing that here would recurse forever on
  // any device where getVoices() legitimately returns [] on first call (very common — it's the
  // whole reason onvoiceschanged/polling exist). If the cache is empty, every .find() below
  // simply returns undefined and we correctly fall through to "no match found".
  const target = (languageCode || '').toLowerCase();
  const prefix = target.split('-')[0];
  let v = cachedVoices.find(v=>v.lang.toLowerCase() === target);
  if(v) return v;
  v = cachedVoices.find(v=>v.lang.toLowerCase().startsWith(prefix+'-'));
  if(v) return v;
  v = cachedVoices.find(v=>v.lang.toLowerCase() === prefix);
  if(v) return v;
  if(prefix === 'en'){
    v = cachedVoices.find(v=>v.lang.toLowerCase().startsWith('en'));
    if(v) return v;
    v = cachedVoices.find(v=>v.default);
    if(v) return v;
  }
  return null; // Hindi/Marathi with no real match: report unavailable, never fake it
}
function updateVoiceStatusUI(){
  const line = document.getElementById('voice-status-line');
  if(!line) return; // settings DOM not built yet on first call
  const icon = document.getElementById('voice-status-icon');
  const detail = document.getElementById('voice-status-detail');
  const langCode = speechLangCode();
  const voice = getBestSpeechVoice(langCode);
  if(voice){
    line.classList.remove('warn');
    icon.textContent = '✓';
    detail.textContent = t('voice_label')+': '+voice.name+'  ·  '+t('voice_lang_label')+': '+voice.lang;
  } else {
    line.classList.add('warn');
    icon.textContent = '⚠';
    detail.textContent = t('voice_unavailable_full');
  }
}
/* CATEGORY_LABEL stays language-live: any code that reads CATEGORY_LABEL[cat] automatically
   gets the current language without needing to touch every call site. */
const CATEGORY_LABEL = new Proxy({}, { get: (_, key) => t(key) });
const LEARNABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');

/* ============================================================
   TIMING — human-perceivable pacing, all in one place, tweakable
   ============================================================ */
const TIMING = BraillePayTiming.TIMING;
/* the real Grade-1 Braille "number sign" cell (dots 3-4-5-6) — shown/felt before every
   digit so letters and digits are physically distinguishable, not just spoken differently */
const NUMBER_SIGN_DOTS = [3,4,5,6];

/* ============================================================
   STATE
   ============================================================ */
const state = {
  speechEnabled: true, hapticsEnabled: true, contrast: false, reducedMotion: false,
  revealInDemo: false, speechRate: 1, textSize: 'normal', intensity: 1, leftHanded:false,
  history: [], mastered: new Set(),
  quiz: { correct:0, total:0, streak:0, currentCh:'', currentCategory:'' },
  demo: { cancelled:false, running:false, token:null },
  voiceEnabled: false, autoLock: true,
  language: 'en',
  auth: { unlocked:false, user:null },
  pinHash: null,
  balance: 0,
  transactions: [],
  send: { recipient:'', recipientName:'', recipientBank:'', amount:0, note:'' }
};

/* ============================================================
   GLOBAL MICRO-INTERACTIONS: ripple ink on every button
   ============================================================ */
document.addEventListener('pointerdown', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 1.4;
  const span = document.createElement('span');
  span.className = 'ripple-ink';
  span.style.width = span.style.height = size+'px';
  span.style.left = (e.clientX - rect.left - size/2)+'px';
  span.style.top = (e.clientY - rect.top - size/2)+'px';
  btn.appendChild(span);
  setTimeout(()=>span.remove(), 650);
});

/* ============================================================
   UTIL: announce / speak
   ============================================================ */
const liveRegion = document.getElementById('live-region');
const liveRegionAssertive = document.getElementById('live-region-assertive');
const deviceScreen = document.getElementById('device-screen');

function speak(text, opts){
  opts = opts || {};
  if(!state.speechEnabled) return;
  if(!('speechSynthesis' in window)) return;
  if(opts.interrupt !== false) window.speechSynthesis.cancel();
  const langCode = speechLangCode();
  const voice = getBestSpeechVoice(langCode);
  const u = new SpeechSynthesisUtterance(text);
  u.lang = langCode;
  if(voice) u.voice = voice; // this is the actual fix: .lang alone is only a hint, .voice is what changes pronunciation
  u.rate = state.speechRate;
  // Stop the microphone while our own voice is talking, resume right after — otherwise Hey
  // Braille can hear its own TTS output and misfire a "command". Both functions are safe
  // no-ops if the voice assistant isn't currently listening.
  if(typeof pauseRecognitionForSpeech === 'function') pauseRecognitionForSpeech();
  u.onend = ()=>{ if(typeof resumeRecognitionAfterSpeech === 'function') resumeRecognitionAfterSpeech(); };
  u.onerror = u.onend;
  window.speechSynthesis.speak(u);
}
function announce(text, assertive){
  const region = assertive ? liveRegionAssertive : liveRegion;
  region.textContent = '';
  requestAnimationFrame(()=>{ region.textContent = text; });
  speak(text);
}

/* ============================================================
   VIBRATION — single source of truth, always cancels before replaying
   ============================================================ */
function scaleMs(ms){ return Math.max(1, Math.round(ms*state.intensity)); }
function vibrateExact(ms){
  if(!state.hapticsEnabled) return;
  if(navigator.vibrate){
    try{ navigator.vibrate(0); navigator.vibrate(scaleMs(ms)); }catch(e){}
  }
}
function vibratePattern(pattern){
  if(!state.hapticsEnabled) return;
  if(navigator.vibrate){
    try{ navigator.vibrate(0); navigator.vibrate(pattern.map(scaleMs)); }catch(e){}
  }
}
function stopVibration(){ if(navigator.vibrate){ try{ navigator.vibrate(0); }catch(e){} } }

/* Screen-level physical feedback: shake + compress */
function playScreenPhysics(){
  if(state.reducedMotion) return;
  deviceScreen.classList.remove('shake-active','compress-active');
  void deviceScreen.offsetWidth;
  deviceScreen.classList.add('shake-active','compress-active');
  setTimeout(()=>deviceScreen.classList.remove('shake-active','compress-active'), 400);
}
/* Expanding ring, duration matched to caller's vibration length */
function playRipple(ringEl, ms){
  if(!ringEl) return;
  ringEl.style.setProperty('--ring-dur', Math.max(200, ms||700)+'ms');
  ringEl.classList.remove('go'); void ringEl.offsetWidth; ringEl.classList.add('go');
}
/* Waveform bars — animates only for the duration of the current vibration burst, then goes flat */
function playWaveformSync(containerEl, durationMs){
  if(!containerEl) return;
  stopWaveform(containerEl);
  containerEl.innerHTML = '';
  const barCount = 10;
  const bars = [];
  for(let i=0;i<barCount;i++){ const b=document.createElement('div'); b.className='bar'; containerEl.appendChild(b); bars.push(b); }
  if(state.reducedMotion){ bars.forEach(b=>b.style.height='14px'); return; }
  let elapsed = 0; const step = 45;
  containerEl._wfInterval = setInterval(()=>{
    elapsed += step;
    bars.forEach(b=> b.style.height = (6 + Math.random()*22)+'px');
    if(elapsed >= durationMs){ stopWaveform(containerEl); }
  }, step);
}
function stopWaveform(containerEl){
  if(!containerEl) return;
  if(containerEl._wfInterval){ clearInterval(containerEl._wfInterval); containerEl._wfInterval = null; }
  containerEl.querySelectorAll('.bar').forEach(b=>b.style.height='4px');
}

/* ============================================================
   BRAILLE CELL RENDERING
   ============================================================ */
function setCellDotsInstant(cellEl, dots){
  if(!cellEl) return;
  cellEl.querySelectorAll('.dot').forEach(d=>{
    const pos = parseInt(d.dataset.dot, 10);
    d.classList.toggle('raised', dots.includes(pos));
  });
}
function setSingleDot(cellEl, pos, active){
  if(!cellEl) return;
  const d = cellEl.querySelector('.dot[data-dot="'+pos+'"]');
  if(!d) return;
  if(active){ d.classList.add('raised','dot-active'); d.classList.remove('pulse'); void d.offsetWidth; d.classList.add('pulse'); }
  else{ d.classList.remove('dot-active'); }
}
function clearCellDots(cellEl){ if(!cellEl) return; cellEl.querySelectorAll('.dot').forEach(d=>d.classList.remove('raised','pulse','dot-active')); }
function buildMiniCell(dots, extraClass){
  const wrap = document.createElement('div');
  wrap.className = 'braille-cell sm' + (extraClass ? ' '+extraClass : '');
  [1,2,3,4,5,6].forEach(pos=>{
    const d = document.createElement('div');
    d.className = 'dot' + (dots.includes(pos) ? ' raised' : '');
    wrap.appendChild(d);
  });
  return wrap;
}
/* individual-dot tap-to-feel, used on every cell */
function wireIndividualDots(cellEl){
  if(!cellEl) return;
  cellEl.querySelectorAll('.dot').forEach(d=>{
    d.setAttribute('aria-label', 'Dot '+d.dataset.dot);
    d.addEventListener('click', (e)=>{
      e.stopPropagation();
      const raised = d.classList.contains('raised');
      d.classList.remove('pulse'); void d.offsetWidth; d.classList.add('pulse');
      vibrateExact(raised ? TIMING.dotVibration : 60);
      announce('Dot '+d.dataset.dot+', '+(raised?'raised':'not raised'));
    });
  });
}
['scan-cell','learn-cell','quiz-cell','viz-cell','demo-cell','settings-preview-cell'].forEach(id=>{
  wireIndividualDots(document.getElementById(id));
});

/* ============================================================
   THE BRAILLE ENGINE — one reusable async playback core,
   used by Scan, Learning, Quiz, Visualizer and the Guided Demo.
   ============================================================ */
function newToken(){ return { cancelled:false, timeouts:[] }; }
function cancelToken(token){
  if(!token) return;
  token.cancelled = true;
  token.timeouts.forEach(id=>clearTimeout(id));
  token.timeouts = [];
  stopVibration();
}
/* Exactly one Braille playback (scan, learn, quiz, visualizer, demo, settings preview) may be
   active app-wide at any moment. Starting a new one always cancels whatever was running before,
   clears its pending timers, stops any in-flight vibration, and cancels queued speech — this is
   what prevents two playbacks (e.g. a rapid double-tap in the learn grid) from overlapping. */
let activePlaybackToken = null;
function beginPlayback(){
  cancelToken(activePlaybackToken);
  try{ if('speechSynthesis' in window) window.speechSynthesis.cancel(); }catch(e){}
  const token = newToken();
  activePlaybackToken = token;
  return token;
}
function wait(ms, token){
  return new Promise(resolve=>{
    if(token && token.cancelled){ resolve(); return; }
    const id = setTimeout(resolve, ms);
    if(token) token.timeouts.push(id);
  });
}

/**
 * Plays exactly one character through the full clarity-first sequence:
 * silence -> dot -> pause -> dot -> pause ... -> settle -> silence.
 * hooks: { cellEl, ringEl, waveformEl, chipEl, revealChar, rate }
 * Resolves once the character (including its trailing silence) is done,
 * or resolves early (without side effects) if token gets cancelled.
 */
async function playOneCharacter(ch, hooks, token){
  hooks = hooks || {};
  const rate = hooks.rate || 1;
  const rt = ms => Math.max(30, Math.round(ms/rate));          // scaled timing
  const category = categoryFor(ch);
  // One entry per Braille cell. An unsupported character is announced and drawn as a full
  // cell, labelled as unsupported, so it is never presented as a real Braille pattern.
  const mapped = category === 'space' ? [] : getBraillePattern(ch, 'en'); // identifiers are always English Grade-1
  const isFallback = category !== 'space' && mapped === null;
  const cells = isFallback ? [[1,2,3,4,5,6]] : mapped;

  if(hooks.cellEl) clearCellDots(hooks.cellEl);
  if(hooks.chipEl){
    hooks.chipEl.textContent = hooks.revealChar ? (CATEGORY_LABEL[category] + (ch===' ' ? '' : ' '+ch.toUpperCase())) : CATEGORY_LABEL[category];
    hooks.chipEl.className = 'category-chip ' + category;
    hooks.chipEl.classList.remove('pop'); void hooks.chipEl.offsetWidth; hooks.chipEl.classList.add('pop');
  }
  const spokenText = isFallback
    ? t('unsupported')
    : (category === 'space'
        ? 'Space'
        : (hooks.revealChar ? (CATEGORY_LABEL[category] + ' ' + ch.toUpperCase()) : CATEGORY_LABEL[category]));
  announce(spokenText);

  await wait(rt(TIMING.beforeChar), token); if(token.cancelled) return;

  if(category === 'digit' && !isFallback){
    // felt/seen/heard cue that unambiguously means "what follows is a digit" — mirrors real Braille's number sign
    announce('Number sign');
    if(hooks.chipEl){ hooks.chipEl.textContent = 'Number sign'; hooks.chipEl.className = 'category-chip digit'; }
    if(hooks.cellEl) setCellDotsInstant(hooks.cellEl, NUMBER_SIGN_DOTS);
    if(hooks.ringEl) playRipple(hooks.ringEl, rt(TIMING.numberSignBuzz*2 + TIMING.numberSignGap));
    if(hooks.waveformEl) playWaveformSync(hooks.waveformEl, rt(TIMING.numberSignBuzz*2 + TIMING.numberSignGap));
    vibratePattern([rt(TIMING.numberSignBuzz), rt(TIMING.numberSignGap), rt(TIMING.numberSignBuzz)]);
    await wait(rt(TIMING.numberSignBuzz*2 + TIMING.numberSignGap), token); if(token.cancelled) return;
    if(hooks.cellEl) clearCellDots(hooks.cellEl);
    if(hooks.chipEl){
      hooks.chipEl.textContent = hooks.revealChar ? (CATEGORY_LABEL[category] + ' ' + ch.toUpperCase()) : CATEGORY_LABEL[category];
      hooks.chipEl.classList.remove('pop'); void hooks.chipEl.offsetWidth; hooks.chipEl.classList.add('pop');
    }
    await wait(rt(TIMING.afterNumberSign), token); if(token.cancelled) return;
  }

  if(category === 'space'){
    if(hooks.ringEl) playRipple(hooks.ringEl, rt(TIMING.spacePulse));
    if(hooks.waveformEl) playWaveformSync(hooks.waveformEl, rt(TIMING.spacePulse));
    vibrateExact(rt(TIMING.spacePulse));
    await wait(rt(TIMING.spacePulse), token); if(token.cancelled) return;
  } else {
    for(let c = 0; c < cells.length; c++){
      if(c > 0){
        // separate the cells of a multi-cell symbol, e.g. "@" = dot 4 then dot 1
        if(hooks.cellEl) clearCellDots(hooks.cellEl);
        await wait(rt(TIMING.cellGap), token); if(token.cancelled) return;
      }
      await playOneCell(cells[c], hooks, token, rt);
      if(token.cancelled) return;
    }
  }

  await wait(rt(TIMING.afterLastDot), token); if(token.cancelled) return;
  if(hooks.cellEl) clearCellDots(hooks.cellEl);
}

/* one 6-dot cell: slots 1..6 buzz for raised dots and stay silent (same length) for the others */
async function playOneCell(dots, hooks, token, rt){
  const allSlots = [1,2,3,4,5,6];
  for(let i = 0; i < allSlots.length; i++){
    if(token.cancelled) return;
    const pos = allSlots[i];
    if(dots.includes(pos)){
      setSingleDot(hooks.cellEl, pos, true);
      if(hooks.ringEl) playRipple(hooks.ringEl, rt(TIMING.dotVibration));
      if(hooks.waveformEl) playWaveformSync(hooks.waveformEl, rt(TIMING.dotVibration));
      vibrateExact(rt(TIMING.dotVibration));
      await wait(rt(TIMING.dotVibration), token); if(token.cancelled) return;
      setSingleDot(hooks.cellEl, pos, false);
    } else {
      // an equal-length SILENT slot — no buzz, but the same amount of time passes
      if(hooks.cellEl){ const d = hooks.cellEl.querySelector('.dot[data-dot="'+pos+'"]'); if(d) d.classList.add('dot-skip'); }
      await wait(rt(TIMING.dotVibration), token); if(token.cancelled) return;
      if(hooks.cellEl){ const d = hooks.cellEl.querySelector('.dot[data-dot="'+pos+'"]'); if(d) d.classList.remove('dot-skip'); }
    }
    if(i < allSlots.length - 1){ await wait(rt(TIMING.dotGap), token); if(token.cancelled) return; }
  }
  if(hooks.cellEl && dots.length) setCellDotsInstant(hooks.cellEl, dots); // settle: show the full cell together
}

/**
 * Creates a controller that plays a sequence of characters one at a time,
 * fully respecting TIMING, with pause/resume/next/prev/replay — and a
 * guarantee that only one playback loop is ever active for this controller.
 */
function createSequencePlayer(opts){
  const ctrl = { token:null, index:0, playing:false, rate:1 };
  async function playFrom(i){
    if(ctrl.token) cancelToken(ctrl.token);
    if(opts.els.waveformEl) stopWaveform(opts.els.waveformEl);
    const chars = opts.getChars();
    if(i < 0) i = 0;
    if(i >= chars.length){ ctrl.playing = false; opts.onDone && opts.onDone(); return; }
    const token = beginPlayback();
    ctrl.token = token;
    ctrl.playing = true;
    ctrl.index = i;
    if(opts.onProgress) opts.onProgress(i, chars.length);
    await playOneCharacter(chars[i], Object.assign({}, opts.els, {rate:ctrl.rate}), token);
    if(token.cancelled || token !== ctrl.token) return;
    await wait(TIMING.beforeNextChar / ctrl.rate, token);
    if(token.cancelled || token !== ctrl.token) return;
    if(ctrl.playing) playFrom(i+1);
  }
  function pause(){
    ctrl.playing = false;
    if(ctrl.token) cancelToken(ctrl.token);
    if(opts.els.waveformEl) stopWaveform(opts.els.waveformEl);
  }
  function resume(){ playFrom(ctrl.index); }
  function replay(){ playFrom(ctrl.index); }
  function next(){ playFrom(ctrl.index+1); }
  function prev(){ playFrom(Math.max(0, ctrl.index-1)); }
  function setRate(r){ ctrl.rate = r; }
  function stop(){ pause(); ctrl.index = 0; }
  return { playFrom, pause, resume, replay, next, prev, setRate, stop, ctrl };
}

/* press-and-hold continuous replay for a single-character cell (learning/quiz/settings/demo) */
function wireHoldToReplay(wrapId, getCh, hooksBuilder, holdBtnEl){
  const wrap = document.getElementById(wrapId);
  if(!wrap) return;
  let holding = false;
  let token = null;
  async function loop(){
    while(holding){
      const ch = getCh();
      if(!ch){ break; }
      token = beginPlayback();
      await playOneCharacter(ch, hooksBuilder(), token);
      if(!holding) break;
    }
  }
  function start(e){
    if(e.target.closest('.dot')) return; // let individual-dot taps win
    if(holding) return;
    holding = true;
    if(holdBtnEl) holdBtnEl.classList.add('holding');
    loop();
  }
  function stop(){
    holding = false;
    if(token) cancelToken(token);
    if(holdBtnEl) holdBtnEl.classList.remove('holding');
  }
  wrap.addEventListener('pointerdown', start);
  wrap.addEventListener('pointerup', stop);
  wrap.addEventListener('pointerleave', stop);
  wrap.addEventListener('pointercancel', stop);
}

/* ============================================================
   NAVIGATION
   ============================================================ */
const SCREEN_TITLES = { home:'Home', scan:'Scan QR', learning:'Learning Mode', visualize:'Visualizer', demo:'Guided Demo', settings:'Accessibility settings', history:'Scan History', about:'About', send:'Send Money', balance:'Balance and Transactions', receive:'Receive Money', requests:'Payment Requests', login:'Sign in', banks:'Banks', notifications:'Notifications', admin:'Demo Dashboard' };
function showScreen(name, opts){
  opts = opts || {};
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  const target = document.getElementById('screen-'+name);
  if(!target) return;
  target.classList.add('active');
  const tabbar = document.getElementById('tabbar-bottom');
  if(tabbar) tabbar.style.display = (name === 'login' || name === 'splash') ? 'none' : '';
  document.querySelectorAll('.tabbar-bottom button').forEach(b=>{ b.setAttribute('aria-current', b.dataset.nav === name ? 'true' : 'false'); });
  if(!opts.silent){ const label = t('scr_'+name); announce(label && label !== ('scr_'+name) ? label+t('screen_suffix') : (SCREEN_TITLES[name] ? SCREEN_TITLES[name]+' screen' : '')); }
  const heading = target.querySelector('.screen-title, h1');
  if(heading){ heading.setAttribute('tabindex','-1'); heading.focus({preventScroll:true}); }
  if(name !== 'scan'){ stopCamera(); if(scanPlayer) scanPlayer.pause(); }
  if(name !== 'visualize' && vizPlayer) vizPlayer.pause();
  if(name !== 'demo' && state.demo.running) stopDemo();
  if(name !== 'learning') stopAutomaticLearning();
  cancelToken(activePlaybackToken);
}
document.body.addEventListener('click', (e)=>{
  const navBtn = e.target.closest('[data-nav]');
  if(navBtn){ showScreen(navBtn.dataset.nav); }
});

/* ============================================================
   SPLASH
   ============================================================ */
function buildDecorativeCells(container, words){ container.innerHTML=''; words.forEach(ch=>container.appendChild(buildMiniCell(patternFor(ch)))); }
buildDecorativeCells(document.getElementById('splash-cells'), ['B','P']);
buildDecorativeCells(document.getElementById('hero-cells'), ['H','I']);
document.getElementById('splash-continue').addEventListener('click', ()=>showScreen('home'));
setTimeout(()=>{ if(document.getElementById('screen-splash').classList.contains('active')) showScreen('home'); }, 2600);

/* ============================================================
   CLOCK
   ============================================================ */
function tickClock(){ document.getElementById('clock').textContent = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
tickClock(); setInterval(tickClock, 15000);

/* ============================================================
   SETTINGS WIRING (instant live preview)
   ============================================================ */
const body = document.body;
function applySettingsToDom(){
  body.dataset.contrast = state.contrast ? 'high' : 'normal';
  body.dataset.motion = state.reducedMotion ? 'reduced' : 'normal';
  body.dataset.hand = state.leftHanded ? 'left' : 'right';
  const scale = state.textSize === 'large' ? 1.14 : state.textSize === 'xlarge' ? 1.3 : 1;
  document.documentElement.style.fontSize = (16*scale)+'px';
}
let settingsPreviewToken = null;
function previewOnSettingsCell(){
  settingsPreviewToken = beginPlayback();
  playOneCharacter('C', { cellEl: document.getElementById('settings-preview-cell'), revealChar:false }, settingsPreviewToken);
}
document.getElementById('set-speech').addEventListener('change', e=>{ state.speechEnabled = e.target.checked; if(e.target.checked) speak('Voice on'); });
document.getElementById('set-haptics').addEventListener('change', e=>{ state.hapticsEnabled = e.target.checked; if(e.target.checked) vibrateExact(60); previewOnSettingsCell(); });
document.getElementById('set-intensity').addEventListener('input', e=>{ state.intensity = parseInt(e.target.value,10)/100; document.getElementById('intensity-value').textContent = e.target.value+'%'; });
document.getElementById('set-intensity').addEventListener('change', ()=>previewOnSettingsCell());
document.getElementById('set-contrast').addEventListener('change', e=>{ state.contrast = e.target.checked; applySettingsToDom(); announce(e.target.checked ? 'High contrast on' : 'High contrast off'); });
document.getElementById('set-motion').addEventListener('change', e=>{ state.reducedMotion = e.target.checked; applySettingsToDom(); });
document.getElementById('set-hand').addEventListener('change', e=>{ state.leftHanded = e.target.checked; applySettingsToDom(); announce(e.target.checked ? 'Left-handed layout on' : 'Left-handed layout off'); });
document.getElementById('set-reveal').addEventListener('change', e=>{ state.revealInDemo = e.target.checked; });
document.querySelectorAll('[data-rate]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('[data-rate]').forEach(b=>b.setAttribute('aria-pressed', b===btn?'true':'false'));
    state.speechRate = parseFloat(btn.dataset.rate);
    document.getElementById('rate-value').textContent = state.speechRate.toFixed(2).replace(/0$/,'')+'×';
    speak('Voice speed set');
  });
});
document.querySelectorAll('[data-lang]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('[data-lang]').forEach(b=>b.setAttribute('aria-pressed', b===btn?'true':'false'));
    state.language = btn.dataset.lang;
    applyLanguage();
  });
});
function applyStaticTranslations(){
  document.documentElement.lang = speechLangCode().split('-')[0];
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const val = t(el.getAttribute('data-i18n'));
    if(val !== undefined) el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el=>{
    const val = t(el.getAttribute('data-i18n-ph'));
    if(val !== undefined) el.placeholder = val;
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el=>{
    const val = t(el.getAttribute('data-i18n-aria'));
    if(val !== undefined) el.setAttribute('aria-label', val);
  });
  // dynamic content not covered by static tags
  document.getElementById('quiz-score').textContent = 'Score: '+state.quiz.correct+' / '+state.quiz.total;
  renderBalanceScreen();
  renderHistory();
}
function applyLanguage(){
  // refresh any currently-visible dynamic strings so a language switch takes effect immediately
  if(!document.getElementById('app-lock').hidden){
    document.getElementById('lock-caption').textContent = biometricAvailable ? t('lock_caption_bio') : t('lock_caption_nobio');
  }
  if(state.voiceEnabled && recognizer){
    try{ recognizer.lang = speechLangCode(); }catch(e){}
    document.getElementById('voice-indicator-text').textContent = listeningForCommand ? t('listening_cmd') : t('listening_wake');
  }
  document.getElementById('voice-status-text').textContent = state.voiceEnabled ? t('voice_on') : t('voice_default');
  applyStaticTranslations();
  updateVoiceStatusUI(); // TTS voice selection is independent of the recognizer.lang line above
  scheduleSave();
}
document.querySelectorAll('[data-textsize]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('[data-textsize]').forEach(b=>b.setAttribute('aria-pressed', b===btn?'true':'false'));
    state.textSize = btn.dataset.textsize; applySettingsToDom();
  });
});
document.getElementById('btn-test-vibration').addEventListener('click', ()=>{ vibrateExact(400); playScreenPhysics(); });
const VOICE_TEST_MESSAGES = {
  en: 'This is the English voice test.',
  hi: 'नमस्ते। यह हिंदी आवाज़ का परीक्षण है।',
  mr: 'नमस्कार. हा मराठी आवाजाचा चाचणी संदेश आहे.'
};
document.getElementById('btn-test-voice').addEventListener('click', ()=>{
  const lang = state.language || 'en';
  speak(VOICE_TEST_MESSAGES[lang] || VOICE_TEST_MESSAGES.en, { interrupt:true });
  if(!getBestSpeechVoice(speechLangCode())){
    showToast(t('voice_unavailable_full'), true);
  }
});
document.getElementById('btn-test-braille').addEventListener('click', ()=>previewOnSettingsCell());
wireHoldToReplay('settings-preview-cell', ()=>'C', ()=>({ cellEl: document.getElementById('settings-preview-cell'), revealChar:false }));

/* ============================================================
   SCAN: camera + jsQR + simulated verification + braille readout
   ============================================================ */
const video = document.getElementById('camera-video');
const canvas = document.getElementById('camera-canvas');
const ctx = canvas.getContext('2d', {willReadFrequently:true});
let cameraStream = null;
let scanRAF = null;

async function startCamera(){
  const placeholder = document.getElementById('camera-placeholder');
  const frame = document.getElementById('scan-frame');
  const statusEl = document.getElementById('camera-status');
  document.getElementById('scan-substate').textContent = 'Requesting camera access…';
  if(!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    document.getElementById('scan-substate').textContent = 'Camera unavailable';
    document.getElementById('btn-start-camera').disabled = false;
    document.getElementById('btn-start-camera').textContent = 'Start camera';
    placeholder.innerHTML = '<span style="font-size:34px;">⚠</span><span>The browser never even asked for camera permission because this page isn\'t running in a secure context (HTTPS or localhost). If you opened this file directly (a file:// address, or a preview/artifact window), camera and microphone access are blocked entirely — the browser won\'t show a prompt at all. Host this file somewhere with HTTPS and open it from that address instead.</span>';
    showToast('Camera blocked: page must be served over HTTPS or localhost.', true);
    return;
  }
  try{
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:'environment' } });
    video.srcObject = cameraStream;
    await video.play();
    placeholder.hidden = true;
    frame.hidden = false; frame.classList.remove('locked');
    statusEl.hidden = false; statusEl.textContent = 'Searching for a QR code…';
    document.getElementById('scan-substate').textContent = 'Camera live — hold a QR code inside the frame';
    document.getElementById('btn-start-camera').textContent = 'Camera active';
    document.getElementById('btn-start-camera').disabled = true;
    announce('Camera started. Searching for a QR code.');
    tickScan();
  }catch(err){
    document.getElementById('scan-substate').textContent = 'Camera unavailable';
    document.getElementById('btn-start-camera').disabled = false;
    document.getElementById('btn-start-camera').textContent = 'Start camera';
    const denied = err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
    const reason = denied ? 'Camera permission was denied.' : ('Couldn\'t access the camera (' + (err && err.message ? err.message : 'unknown error') + ').');
    placeholder.innerHTML = '<span style="font-size:34px;">⚠</span><span>'+reason+' This also happens if the page isn\'t served over HTTPS or localhost.</span>';
    const retryBtn = document.createElement('button');
    retryBtn.className = 'retry-btn';
    retryBtn.textContent = 'Retry camera access';
    retryBtn.addEventListener('click', startCamera);
    placeholder.appendChild(retryBtn);
    announce('Camera could not be started. You can retry, or try the no-camera demo scan instead.', true);
    showToast(denied ? 'Camera permission denied — you can retry or use the no-camera demo.' : 'Camera unavailable — you can retry or use the no-camera demo.', true);
  }
}
function stopCamera(){
  if(scanRAF) cancelAnimationFrame(scanRAF);
  scanRAF = null;
  if(cameraStream){ cameraStream.getTracks().forEach(t=>t.stop()); cameraStream = null; }
  video.srcObject = null;
  document.getElementById('camera-placeholder').hidden = false;
  document.getElementById('scan-frame').hidden = true;
  document.getElementById('camera-status').hidden = true;
  document.getElementById('btn-start-camera').textContent = 'Start camera';
  document.getElementById('btn-start-camera').disabled = false;
}
function tickScan(){
  if(!cameraStream) return;
  if(video.readyState === video.HAVE_ENOUGH_DATA){
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0,0,canvas.width, canvas.height);
    const code = window.jsQR ? window.jsQR(imageData.data, imageData.width, imageData.height, {inversionAttempts:'dontInvert'}) : null;
    if(code && code.data){ lockOnThenDecode(code.data, 'camera'); return; }
  }
  scanRAF = requestAnimationFrame(tickScan);
}
document.getElementById('btn-start-camera').addEventListener('click', startCamera);
document.getElementById('btn-try-demo-scan').addEventListener('click', ()=>{
  const samples = ['A1B2C3','WELCOME 42','Q7X 9K','HELLO 5', 'upi://pay?pa=rahul123@ybl&pn=Rahul%20Sharma&am=250&tr=TXN482100&cu=INR'];
  const pick = samples[Math.floor(Math.random()*samples.length)];
  document.getElementById('scan-frame').hidden = false;
  document.getElementById('camera-placeholder').hidden = true;
  lockOnThenDecode(pick, 'demo');
});
document.getElementById('btn-use-demo-qr').addEventListener('click', async ()=>{
  const list = document.getElementById('scan-demo-qr-list');
  list.hidden = false;
  list.innerHTML = '';
  const loading = document.createElement('span');
  loading.className = 'cell-caption';
  loading.textContent = 'Loading demo accounts…';
  list.appendChild(loading);
  try{
    const users = await api.getDemoQRList();
    list.innerHTML = '';
    users
      .filter(u => !state.auth.user || u.upi_id !== state.auth.user.upi_id)
      .forEach(u=>{
        const chip = document.createElement('button');
        chip.className = 'preset-chip';
        chip.type = 'button';
        chip.textContent = u.name;
        chip.setAttribute('aria-label', 'Simulate scanning '+u.name+"'s BraillePay QR");
        chip.addEventListener('click', ()=>{
          list.hidden = true;
          document.getElementById('scan-frame').hidden = false;
          document.getElementById('camera-placeholder').hidden = true;
          lockOnThenDecode(JSON.stringify(u.payload), 'demo-qr');
        });
        list.appendChild(chip);
      });
  }catch(e){
    list.innerHTML = '';
    const err = document.createElement('span');
    err.className = 'cell-caption';
    err.style.color = 'var(--danger)';
    err.textContent = 'Could not load demo accounts — is the BraillePay server running?';
    list.appendChild(err);
  }
});

function lockOnThenDecode(text, source){
  const frame = document.getElementById('scan-frame');
  frame.hidden = false;
  frame.classList.add('locked');
  vibratePattern([50,40,90]);
  document.getElementById('scan-substate').textContent = 'QR code locked';
  document.getElementById('camera-status').textContent = 'Locked — verifying…';
  announce('QR code locked. Verifying.');
  setTimeout(()=>runVerification(text, source), 550);
}

/* ============================================================
   UPI QR PAYLOAD — parsed by js/upi-parser.js (unit-tested).
   Only the payee ID (pa) is read by default; the amount, note and
   payee name are read only when the person asks for them. Scanning
   never starts a payment. Non-UPI codes keep the original behaviour
   (the decoded text is read in Braille).
   ============================================================ */
let scanPlayer = null;
let scanText = '';
let scanRecorded = false;
let scanSourceLabel = 'camera';

function runVerification(text, source){
  scanRecorded = false;
  scanSourceLabel = source || 'camera';
  // BraillePay's own payment QR payload gets a dedicated, backend-verified, privacy-preserving flow
  let braillePayPayload = null;
  try{
    const parsed = JSON.parse(text);
    if(parsed && parsed.type === 'braillepay_payment' && parsed.upi_id) braillePayPayload = parsed;
  }catch(e){ /* not JSON — this is an ordinary QR, fall through */ }
  if(braillePayPayload){ runBraillePayQrFlow(braillePayPayload, source); return; }

  stopCamera();
  document.getElementById('scan-start-controls').hidden = true;
  document.getElementById('scan-summary').hidden = true;
  document.getElementById('camera-wrap').style.display = 'none';
  document.getElementById('scan-verify').hidden = false;
  document.getElementById('upi-field-controls').hidden = true;
  currentUpi = null;

  const upi = BraillePayUPI.parseUpiUri(text);
  const isUpiLink = /^\s*upi:/i.test(text);
  const ring = document.getElementById('confidence-ring');
  const valueEl = document.getElementById('confidence-value');
  ring.style.setProperty('--pct', 0);
  valueEl.textContent = '0%';
  const stepsWrap = document.getElementById('verify-steps');
  stepsWrap.innerHTML = '';
  const steps = upi.ok ? [
    { label:'Payee', detail: upi.payeeName ? upi.payeeName : 'Name not in this code' },
    { label:'UPI ID', detail: upi.vpa + ' — read first, by default' },
    { label:'Other fields', detail: 'Amount, note and payee name are separate controls. Scanning does not pay.' },
    { label:'Verification Complete', detail:'Simulated — no real bank or UPI network was contacted' }
  ] : (isUpiLink ? [
    { label:'UPI code not read', detail: upi.message },
    { label:'Verification Complete', detail:'Nothing was read aloud. Scan the code again.' }
  ] : [
    { label:'QR Decoded', detail:'Content read successfully from the code' },
    { label:'Payment Fields', detail:'QR decoded, payment fields could not be parsed.' },
    { label:'Verification Complete', detail:'Simulated — showing character-by-character verification below' }
  ]);
  const stepEls = steps.map(s=>{
    const el = document.createElement('div');
    el.className = 'vstep';
    el.innerHTML = '<div class="vicon"><span class="vspin"></span></div><div class="vtext"><b>'+s.label+'</b><span>'+s.detail+'</span></div>';
    stepsWrap.appendChild(el);
    return el;
  });
  announce('Running simulated verification.');
  let pct = 0;
  const totalDuration = 2600;
  const startTime = performance.now();
  function animateConfidence(now){
    const tt = Math.min(1, (now-startTime)/totalDuration);
    const eased = 1 - Math.pow(1-tt, 3);
    pct = Math.round(eased*100);
    ring.style.setProperty('--pct', pct);
    valueEl.textContent = pct+'%';
    if(tt < 1) requestAnimationFrame(animateConfidence);
  }
  requestAnimationFrame(animateConfidence);
  stepEls.forEach((el, i)=>{
    setTimeout(()=>{
      el.classList.add('done');
      el.querySelector('.vicon').innerHTML = '✓';
      vibrateExact(70);
      speak(steps[i].label + (i<steps.length-1 ? ' verified' : ''));
    }, 500 + i*620);
  });
  setTimeout(()=>{
    vibratePattern([90,60,90,60,180]);
    playScreenPhysics();
    document.getElementById('scan-verify').hidden = true;
    if(upi.ok){
      announce('Verification complete. The UPI ID is read first, one dot at a time.', true);
      beginUpiReadout(upi);
    } else if(isUpiLink){
      announce('This UPI code could not be read. '+upi.message, true);
      showToast(upi.message, true);
      setTimeout(()=>{
        document.getElementById('scan-start-controls').hidden = false;
        document.getElementById('camera-wrap').style.display = '';
      }, 1200);
    } else {
      announce('Verification complete. Now reading the code, one dot at a time.', true);
      beginBrailleReadout(text, source);
    }
  }, 500 + steps.length*620 + 500);
}


/* ============================================================
   BRAILLEPAY PAYMENT QR — dedicated, backend-verified flow.
   The recipient's identity is deliberately NOT shown on screen
   or spoken aloud until the person has felt it out privately in
   Braille and chosen to continue — see Part 33 of the spec.
   ============================================================ */
async function runBraillePayQrFlow(payload, source){
  stopCamera();
  document.getElementById('scan-start-controls').hidden = true;
  document.getElementById('scan-summary').hidden = true;
  document.getElementById('camera-wrap').style.display = 'none';
  document.getElementById('scan-verify').hidden = false;
  const ring = document.getElementById('confidence-ring');
  const valueEl = document.getElementById('confidence-value');
  ring.style.setProperty('--pct', 0); valueEl.textContent = '0%';
  const stepsWrap = document.getElementById('verify-steps');
  stepsWrap.innerHTML = '';
  const steps = [
    { label:'BraillePay QR detected', detail:'A personal BraillePay payment identity. Category confirmed — identity stays private for now.' },
    { label:'Checking with BraillePay', detail:'Verifying this identity against the server (simulated — no bank or UPI network involved).' },
    { label:'Ready to reveal privately', detail:'Feel the name in Braille below, then continue to enter an amount.' }
  ];
  const stepEls = steps.map(s=>{
    const el = document.createElement('div');
    el.className = 'vstep';
    el.innerHTML = '<div class="vicon"><span class="vspin"></span></div><div class="vtext"><b>'+s.label+'</b><span>'+s.detail+'</span></div>';
    stepsWrap.appendChild(el);
    return el;
  });
  announce('BraillePay payment QR detected. Verifying — the recipient stays private for now.', true);

  let pct = 0;
  const totalDuration = 1400;
  const startTime = performance.now();
  function animateConfidence(now){
    const tt = Math.min(1, (now-startTime)/totalDuration);
    pct = Math.round((1-Math.pow(1-tt,3))*100);
    ring.style.setProperty('--pct', pct); valueEl.textContent = pct+'%';
    if(tt < 1) requestAnimationFrame(animateConfidence);
  }
  requestAnimationFrame(animateConfidence);
  stepEls[0].classList.add('done'); stepEls[0].querySelector('.vicon').innerHTML = '✓';
  vibrateExact(70);

  let verified = null;
  try{
    verified = await api.lookupUser(payload.upi_id);
  }catch(e){
    stepEls[1].classList.add('done');
    stepEls[1].querySelector('.vicon').innerHTML = '⚠';
    stepEls[1].querySelector('.vtext').innerHTML = '<b>Could not verify</b><span>'+(e.detail || 'This BraillePay identity could not be verified.')+'</span>';
    announce('This QR could not be verified. '+(e.detail || ''), true);
    setTimeout(()=>{
      document.getElementById('scan-verify').hidden = true;
      document.getElementById('scan-start-controls').hidden = false;
      document.getElementById('camera-wrap').style.display = '';
    }, 2200);
    return;
  }
  stepEls[1].classList.add('done'); stepEls[1].querySelector('.vicon').innerHTML = '✓';
  vibrateExact(70);

  setTimeout(()=>{
    stepEls[2].classList.add('done'); stepEls[2].querySelector('.vicon').innerHTML = '✓';
    vibratePattern([90,60,90,60,180]);
    document.getElementById('scan-verify').hidden = true;
    beginBraillePayReveal(verified);
  }, 500);
}

function beginBraillePayReveal(verified){
  document.getElementById('scan-player').hidden = false;
  const text = verified.user.name;
  const chars = text.split('');
  scanPlayer = createSequencePlayer({
    getChars: ()=>chars,
    els: {
      cellEl: document.getElementById('scan-cell'), ringEl: document.getElementById('scan-ring'),
      waveformEl: document.getElementById('scan-waveform'), chipEl: document.getElementById('scan-chip'),
      revealChar: false
    },
    onProgress: (i, total)=>{
      document.getElementById('scan-caption').textContent = chars[i] === ' '
        ? 'A space — one longer pulse marks it.'
        : 'Feel this letter of the recipient\'s name. It stays off-screen until you continue.';
      document.getElementById('scan-progress-label').textContent = 'Letter '+(i+1)+' of '+total;
      document.getElementById('scan-progress-pct').textContent = Math.round(((i+1)/total)*100)+'%';
      document.getElementById('scan-progress-fill').style.width = (((i+1)/total)*100)+'%';
    },
    onDone: ()=>proceedToSendFromQr(verified)
  });
  scanPlayer.setRate(1.4);
  document.getElementById('scan-substate').textContent = 'Feel the recipient\'s name in Braille, one letter at a time';
  announce('Reading the recipient\'s name in Braille now. It stays private until you continue to payment.');
}

function proceedToSendFromQr(verified){
  document.getElementById('scan-player').hidden = true;
  showScreen('send');
  state.send.recipient = verified.user.upi_id;
  state.send.recipientName = verified.user.name;
  state.send.recipientBank = verified.bank.name;
  document.getElementById('rp-name').textContent = verified.user.name;
  document.getElementById('rp-upi').textContent = verified.user.upi_id;
  document.getElementById('rp-bank').textContent = verified.bank.name;
  document.getElementById('send-recipient-card').hidden = false;
  sendRecipientInput.value = verified.user.upi_id;
  document.getElementById('send-balance-display').textContent = '₹'+Number(state.balance).toLocaleString('en-IN');
  showSendStep('amount');
  announce('Recipient verified: '+verified.user.name+'. Enter an amount to send.', true);
}

let scanHoldWired = false;
let currentUpi = null;

/* starts the one-character-at-a-time player on any text (generic QR text, or one UPI field) */
function startScanSequence(text){
  scanText = text;
  if(scanPlayer) scanPlayer.pause();
  document.getElementById('scan-player').hidden = false;
  scanPlayer = createSequencePlayer({
    getChars: ()=>scanText.split(''),
    els: {
      cellEl: document.getElementById('scan-cell'),
      ringEl: document.getElementById('scan-ring'),
      waveformEl: document.getElementById('scan-waveform'),
      chipEl: document.getElementById('scan-chip'),
      revealChar: false
    },
    onProgress: (i, total)=>{
      const ch = scanText.split('')[i];
      document.getElementById('scan-caption').textContent = ch === ' '
        ? 'A space — one longer pulse marks it.'
        : (patternForRaw(ch) === null ? 'Unsupported symbol — shown as a full cell, so it is not a real Braille pattern.' : 'One dot at a time. Feel where each one starts and stops.');
      document.getElementById('scan-progress-label').textContent = 'Character '+(i+1)+' of '+total;
      document.getElementById('scan-progress-pct').textContent = Math.round(((i+1)/total)*100)+'%';
      document.getElementById('scan-progress-fill').style.width = (((i+1)/total)*100)+'%';
    },
    onDone: finishScan
  });
  scanPlayer.setRate(1.4); // Payment Verification Mode default — faster than Learning Mode's 1x, still adjustable
  if(!scanHoldWired){
    scanHoldWired = true;
    wireHoldToReplay('scan-cell', ()=>scanText.split('')[scanPlayer.ctrl.index], ()=>({
      cellEl: document.getElementById('scan-cell'), ringEl: document.getElementById('scan-ring'),
      waveformEl: document.getElementById('scan-waveform'), chipEl: document.getElementById('scan-chip'), revealChar:false
    }));
  }
  document.getElementById('scan-play-pause').textContent = '⏸';
  scanPlayer.playFrom(0);
}

/* generic QR text that is not a UPI payment: the whole decoded text, as before */
function beginBrailleReadout(text, source){
  startScanSequence(text);
}

/* ---- UPI: the payee ID is read by default; other fields only when the person asks ---- */
function beginUpiReadout(parsed){
  currentUpi = parsed;
  document.getElementById('upi-field-controls').hidden = false;
  const fields = BraillePayUPI.optionalFields(parsed);
  document.querySelectorAll('[data-upi-field]').forEach(btn=>{
    const field = fields.find(f=>f.id===btn.dataset.upiField);
    const present = !!field && field.value !== null && field.value !== '';
    btn.disabled = !present;
    btn.title = present ? '' : 'Not in this code';
  });
  readUpiField('upi');
}
function readUpiField(fieldId){
  if(!currentUpi || !currentUpi.ok) return;
  const field = BraillePayUPI.optionalFields(currentUpi).find(f=>f.id===fieldId);
  if(!field) return;
  if(field.value === null || field.value === ''){
    announce(field.label+' is not in this code.', true);
    return;
  }
  document.getElementById('scan-substate').textContent = 'Reading the '+field.label.toLowerCase()+' in Braille';
  announce('Reading the '+field.label.toLowerCase()+'.');
  startScanSequence(String(field.value));
}
document.querySelectorAll('[data-upi-field]').forEach(btn=>{
  btn.addEventListener('click', ()=>readUpiField(btn.dataset.upiField));
});

function finishScan(){
  document.getElementById('scan-player').hidden = true;
  document.getElementById('scan-summary').hidden = false;
  const chars = scanText.split('');
  const counts = {letter:0, digit:0, other:0};
  chars.forEach(c=>{ const cat = categoryFor(c); if(cat==='letter') counts.letter++; else if(cat==='digit') counts.digit++; else counts.other++; });
  document.getElementById('sum-total').textContent = chars.length;
  document.getElementById('sum-letters').textContent = counts.letter;
  document.getElementById('sum-digits').textContent = counts.digit;
  document.getElementById('sum-other').textContent = counts.other;
  document.getElementById('reveal-box').hidden = true;
  document.getElementById('reveal-box').textContent = '';
  document.getElementById('btn-reveal-text').textContent = 'Show text (sighted demo aid)';
  announce('Scan complete. '+chars.length+' characters: '+counts.letter+' letters, '+counts.digit+' digits.', true);
  vibratePattern([120,60,120,60,220]);
  playScreenPhysics();
  // one history entry per scanned code (not one per field read); 'read' = the readout completed
  if(!scanRecorded){
    scanRecorded = true;
    state.history.unshift({ id: Date.now(), timestamp: new Date(), total: chars.length, letters: counts.letter, digits: counts.digit, other: counts.other, source: scanSourceLabel, status: 'read', text: scanText });
  }
  renderHistory();
}
document.getElementById('scan-play-pause').addEventListener('click', (e)=>{
  if(!scanPlayer) return;
  if(scanPlayer.ctrl.playing){ scanPlayer.pause(); e.target.textContent='▶'; e.target.setAttribute('aria-label','Resume'); announce('Paused'); }
  else { scanPlayer.resume(); e.target.textContent='⏸'; e.target.setAttribute('aria-label','Pause'); }
});
document.getElementById('scan-replay-char').addEventListener('click', ()=>scanPlayer && scanPlayer.replay());
document.getElementById('scan-skip').addEventListener('click', ()=>scanPlayer && scanPlayer.next());
document.querySelectorAll('#screen-scan .speed-pills .pill').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('#screen-scan .speed-pills .pill').forEach(b=>b.setAttribute('aria-pressed', b===btn?'true':'false'));
    if(scanPlayer) scanPlayer.setRate(parseFloat(btn.dataset.speed));
  });
});
document.getElementById('btn-reveal-text').addEventListener('click', (e)=>{
  const box = document.getElementById('reveal-box');
  const revealed = box.hidden;
  box.hidden = !revealed;
  box.textContent = revealed ? scanText : '';
  e.target.textContent = revealed ? 'Hide text' : 'Show text (sighted demo aid)';
});
document.getElementById('btn-replay-scan').addEventListener('click', ()=>{
  document.getElementById('scan-summary').hidden = true;
  document.getElementById('scan-player').hidden = false;
  if(scanPlayer) scanPlayer.playFrom(0);
});
document.getElementById('btn-scan-again').addEventListener('click', resetScanScreen);
function resetScanScreen(){
  if(scanPlayer) scanPlayer.stop();
  document.getElementById('scan-start-controls').hidden = false;
  document.getElementById('scan-verify').hidden = true;
  document.getElementById('scan-player').hidden = true;
  document.getElementById('scan-summary').hidden = true;
  document.getElementById('camera-wrap').style.display = '';
  document.getElementById('scan-frame').classList.remove('locked');
  clearCellDots(document.getElementById('scan-cell'));
}

/* ============================================================
   LEARNING MODE — full A–Z + 0–9
   ============================================================ */
document.querySelectorAll('#screen-learning .tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('#screen-learning .tab-btn').forEach(b=>b.setAttribute('aria-selected', b===btn?'true':'false'));
    const isBrowse = btn.dataset.tab === 'browse';
    document.getElementById('learning-browse').hidden = !isBrowse;
    document.getElementById('learning-quiz').hidden = isBrowse;
    if(!isBrowse) newQuizPattern();
  });
});
function updateMastery(){
  const pct = Math.round((state.mastered.size / LEARNABLE.length)*100);
  document.getElementById('mastery-fill').style.width = pct+'%';
  document.getElementById('mastery-label').textContent = state.mastered.size+' / '+LEARNABLE.length+' mastered';
}
let learnActiveChar = null;
function buildCharGrid(){
  const grid = document.getElementById('char-grid');
  grid.innerHTML = '';
  LEARNABLE.forEach(ch=>{
    const b = document.createElement('button');
    const cat = categoryFor(ch);
    b.className = 'char-tile ' + cat + (state.mastered.has(ch) ? ' mastered' : '');
    b.textContent = ch;
    b.setAttribute('aria-label', (cat==='letter'?'Letter ':'Digit ') + ch);
    b.addEventListener('click', ()=>playLearningCharacter(ch));
    grid.appendChild(b);
  });
  updateMastery();
}
wireHoldToReplay('learn-cell', ()=>learnActiveChar, ()=>({
  cellEl: document.getElementById('learn-cell'), ringEl: document.getElementById('learn-ring'),
  chipEl: document.getElementById('learn-chip'), revealChar:true
}));

/* ============================================================
   LEARNING MODE — AUTOMATIC LESSON CONTROLLER

   One shared playback function, playLearningCharacter(), backs
   every entry point: the automatic A-Z/0-9 lesson, manual grid
   taps, and "Hey Braille, vibrate X" — so a given character
   always produces the identical Braille pattern + haptic +
   speech + visual output no matter which of the three triggered
   it. Automatic playback advances via a recursive continuation
   (playNextLearningCharacter calling itself through a promise
   chain), deliberately not setInterval, so a character's full
   playback — including its own internal awaits — always finishes
   before the next one can begin. Combined with the app-wide
   beginPlayback()/cancelToken() token gate, at most one Learning
   Mode sequence can ever be in flight at a time.
   ============================================================ */
const LEARNING_SEQUENCE = LEARNABLE.slice(); // same source/order as the manual grid: A-Z, 0-9
let learningRate = 1;
let learningState = { isAutoLearning:false, index:0, token:null };

function learningHooks(){
  return {
    cellEl: document.getElementById('learn-cell'),
    ringEl: document.getElementById('learn-ring'),
    chipEl: document.getElementById('learn-chip'),
    revealChar: true,
    rate: learningRate
  };
}
function updateLearningProgressUI(ch){
  const idx = LEARNING_SEQUENCE.indexOf(ch);
  const el = document.getElementById('auto-lesson-progress');
  if(!el || idx === -1) return;
  const label = (idx+1) + ' / ' + LEARNING_SEQUENCE.length;
  el.textContent = label;
  el.setAttribute('aria-label', t('learning_progress_prefix') + ': ' + label);
}
function markLearningMastered(ch){
  if(state.mastered.has(ch)) return;
  state.mastered.add(ch);
  updateMastery();
  document.querySelectorAll('#char-grid .char-tile').forEach(b=>{ if(b.textContent === ch) b.classList.add('mastered'); });
  scheduleSave();
}
/* Shared entry point — every learning interaction (manual tap, automatic lesson step,
   Hey Braille voice command) calls this same function and nothing else. */
async function playLearningCharacter(ch){
  ch = (ch || '').toString().toUpperCase();
  if(LEARNING_SEQUENCE.indexOf(ch) === -1) return;
  stopAutomaticLearning(); // manual/voice selection always halts the auto sequence first
  learnActiveChar = ch;
  updateLearningProgressUI(ch);
  const token = beginPlayback();
  await playOneCharacter(ch, learningHooks(), token);
  if(!token.cancelled) markLearningMastered(ch);
}
async function playNextLearningCharacter(){
  if(!learningState.isAutoLearning) return; // Stop was pressed
  if(learningState.index >= LEARNING_SEQUENCE.length){ finishAutomaticLearning(); return; }
  const ch = LEARNING_SEQUENCE[learningState.index];
  learnActiveChar = ch;
  updateLearningProgressUI(ch);
  const token = beginPlayback();
  learningState.token = token;
  await playOneCharacter(ch, learningHooks(), token);
  if(token.cancelled || !learningState.isAutoLearning) return; // Stop pressed during this character
  markLearningMastered(ch);
  learningState.index++;
  const pauseMs = Math.max(150, Math.round(500/learningRate));
  await wait(pauseMs, token);
  if(token.cancelled || !learningState.isAutoLearning) return;
  playNextLearningCharacter(); // recursive continuation, not setInterval — never overlaps
}
function startAutomaticLearning(){
  stopAutomaticLearning();
  learningState.isAutoLearning = true;
  learningState.index = 0;
  const stopBtn = document.getElementById('learning-stop-btn');
  const startBtn = document.getElementById('learning-start-btn');
  const completePanel = document.getElementById('learning-complete-panel');
  if(stopBtn) stopBtn.hidden = false;
  if(startBtn) startBtn.hidden = true;
  if(completePanel) completePanel.hidden = true;
  announce(t('learning_intro_speech'));
  playNextLearningCharacter();
}
function stopAutomaticLearning(){
  const wasRunning = learningState.isAutoLearning;
  learningState.isAutoLearning = false;
  cancelToken(learningState.token);
  try{ if('speechSynthesis' in window) window.speechSynthesis.cancel(); }catch(e){}
  const stopBtn = document.getElementById('learning-stop-btn');
  const startBtn = document.getElementById('learning-start-btn');
  if(stopBtn) stopBtn.hidden = true;
  if(wasRunning && startBtn) startBtn.hidden = false; // Start button only appears after a stop, per spec
}
function finishAutomaticLearning(){
  learningState.isAutoLearning = false;
  const stopBtn = document.getElementById('learning-stop-btn');
  const completePanel = document.getElementById('learning-complete-panel');
  if(stopBtn) stopBtn.hidden = true;
  if(completePanel) completePanel.hidden = false;
  announce(t('learning_complete_speech'));
}
document.getElementById('learning-stop-btn').addEventListener('click', stopAutomaticLearning);
document.getElementById('learning-start-btn').addEventListener('click', startAutomaticLearning);
document.getElementById('learning-repeat-btn').addEventListener('click', startAutomaticLearning);
document.querySelectorAll('#auto-lesson-panel [data-learnspeed]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('#auto-lesson-panel [data-learnspeed]').forEach(b=>b.setAttribute('aria-pressed', b===btn?'true':'false'));
    learningRate = parseFloat(btn.dataset.learnspeed);
  });
});
// Switching to the Practice Quiz tab must stop any running automatic lesson — no teaching
// should continue in the background on a tab the user can't see.
document.getElementById('tab-quiz').addEventListener('click', stopAutomaticLearning);

function newQuizPattern(){
  const ch = LEARNABLE[Math.floor(Math.random()*LEARNABLE.length)];
  state.quiz.currentCh = ch;
  state.quiz.currentCategory = categoryFor(ch);
  document.getElementById('quiz-caption').textContent = 'Feel the pattern (or listen to the vibration), then guess.';
  document.querySelectorAll('.choice-btn').forEach(b=>b.classList.remove('correct','wrong'));
  const token = beginPlayback();
  playOneCharacter(ch, {
    cellEl: document.getElementById('quiz-cell'), ringEl: document.getElementById('quiz-ring'), revealChar:false
  }, token);
}
function handleQuizGuess(guess){
  state.quiz.total++;
  const correct = guess === state.quiz.currentCategory;
  if(correct){ state.quiz.correct++; state.quiz.streak++; } else { state.quiz.streak = 0; }
  document.getElementById('quiz-score').textContent = 'Score: '+state.quiz.correct+' / '+state.quiz.total;
  const streakBadge = document.getElementById('streak-badge');
  streakBadge.textContent = '🔥 Streak: '+state.quiz.streak;
  if(state.quiz.streak>0 && state.quiz.streak % 5 === 0){
    streakBadge.classList.remove('burst'); void streakBadge.offsetWidth; streakBadge.classList.add('burst');
    const toast = document.getElementById('level-toast');
    toast.textContent = 'Level up! Streak ×'+state.quiz.streak+' 🎉';
    toast.classList.add('show');
    vibratePattern([60,40,60,40,120]);
    setTimeout(()=>toast.classList.remove('show'), 1600);
  }
  const btn = guess === 'letter' ? document.getElementById('quiz-guess-letter') : document.getElementById('quiz-guess-digit');
  btn.classList.add(correct ? 'correct' : 'wrong');
  document.getElementById('quiz-caption').textContent = t(correct ? 'quiz_correct' : 'quiz_not_quite') + t('quiz_it_was') + CATEGORY_LABEL[state.quiz.currentCategory] + ' ' + state.quiz.currentCh + '.';
  announce(t(correct ? 'quiz_correct' : 'quiz_not_quite') + t('quiz_it_was') + CATEGORY_LABEL[state.quiz.currentCategory] + ' ' + state.quiz.currentCh);
}
document.getElementById('quiz-guess-letter').addEventListener('click', ()=>handleQuizGuess('letter'));
document.getElementById('quiz-guess-digit').addEventListener('click', ()=>handleQuizGuess('digit'));
document.getElementById('quiz-replay').addEventListener('click', ()=>{
  const token = beginPlayback();
  playOneCharacter(state.quiz.currentCh, { cellEl: document.getElementById('quiz-cell'), ringEl: document.getElementById('quiz-ring'), revealChar:false }, token);
});
document.getElementById('quiz-next').addEventListener('click', newQuizPattern);
wireHoldToReplay('quiz-cell', ()=>state.quiz.currentCh, ()=>({
  cellEl: document.getElementById('quiz-cell'), ringEl: document.getElementById('quiz-ring'), revealChar:false
}));

/* ============================================================
   VISUALIZER — full A–Z, spaces, punctuation, new timing throughout
   ============================================================ */
const vizPresets = ['HELLO', 'BRAILLE 123', 'ABC', 'DEMO 500'];
const presetRow = document.getElementById('viz-presets');
vizPresets.forEach(p=>{
  const chip = document.createElement('button');
  chip.className = 'preset-chip'; chip.textContent = p;
  chip.addEventListener('click', ()=>{ document.getElementById('viz-input').value = p; loadViz(p); });
  presetRow.appendChild(chip);
});
let vizPlayer = null;
let vizChars = [];
function loadViz(text){
  if(vizPlayer) vizPlayer.stop();
  vizChars = text.split('');
  renderVizStrip();
  vizPlayer = createSequencePlayer({
    getChars: ()=>vizChars,
    els: { cellEl: document.getElementById('viz-cell'), ringEl: document.getElementById('viz-ring'), revealChar:true },
    onProgress: (i, total)=>{
      const ch = vizChars[i];
      document.getElementById('viz-caption').textContent = 'Character '+(i+1)+' of '+total+' — “'+ch+'”';
      document.querySelectorAll('#viz-strip .braille-cell').forEach((el,idx)=>{ el.classList.toggle('active', idx===i); el.classList.toggle('done', idx<i); });
      updateVizMeta(i, total);
    },
    onDone: ()=>{ document.getElementById('viz-play-pause').textContent = '▶'; announce('Visualization complete'); }
  });
  document.getElementById('viz-play-pause').textContent = '▶';
  updateVizMeta(-1, vizChars.length);
  clearCellDots(document.getElementById('viz-cell'));
  document.getElementById('viz-caption').textContent = 'Character 0 of '+vizChars.length+' — “”';
}
function renderVizStrip(){
  const strip = document.getElementById('viz-strip');
  strip.innerHTML = '';
  vizChars.forEach((ch,i)=>{ const el = buildMiniCell(patternFor(ch)); el.dataset.idx = i; strip.appendChild(el); });
}
function updateVizMeta(i, total){
  document.getElementById('viz-index-label').textContent = 'Index '+(total?Math.max(1,i+1):0)+'/'+total;
  const remaining = Math.max(0, total - (i+1));
  const rate = vizPlayer ? vizPlayer.ctrl.rate : 1;
  const perCharMs = TIMING.beforeChar + TIMING.afterLastDot + TIMING.beforeNextChar + 6*TIMING.dotVibration + 5*TIMING.dotGap;
  const secs = Math.round((remaining * (perCharMs/rate))/1000);
  document.getElementById('viz-eta-label').textContent = '~'+secs+'s remaining';
}
document.getElementById('viz-input').addEventListener('input', (e)=>loadViz(e.target.value));
document.getElementById('viz-play-pause').addEventListener('click', (e)=>{
  if(!vizPlayer || !vizChars.length) return;
  if(vizPlayer.ctrl.playing){ vizPlayer.pause(); e.target.textContent='▶'; }
  else { vizPlayer.resume(); e.target.textContent='⏸'; }
});
document.getElementById('viz-replay').addEventListener('click', ()=>vizPlayer && vizPlayer.playFrom(0));
document.getElementById('viz-skip').addEventListener('click', ()=>vizPlayer && vizPlayer.next());
document.getElementById('viz-prev').addEventListener('click', ()=>vizPlayer && vizPlayer.prev());
document.querySelectorAll('#screen-visualize .speed-pills .pill').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('#screen-visualize .speed-pills .pill').forEach(b=>b.setAttribute('aria-pressed', b===btn?'true':'false'));
    if(vizPlayer) vizPlayer.setRate(parseFloat(btn.dataset.vizspeed));
  });
});
wireHoldToReplay('viz-cell', ()=>vizPlayer ? vizChars[vizPlayer.ctrl.index] : null, ()=>({
  cellEl: document.getElementById('viz-cell'), ringEl: document.getElementById('viz-ring'), revealChar:true
}));
loadViz('BRAILLEPAY');

/* ============================================================
   HISTORY (search + filter + quick replay)
   ============================================================ */
let historyFilter = 'all';
let historySearch = '';
function quickPreviewPattern(dots){
  const seq = [];
  [1,2,3,4,5,6].forEach(pos=>{ if(dots.includes(pos)){ seq.push(70,60); } else { seq.push(1,90); } });
  return seq;
}
function renderHistory(){
  const list = document.getElementById('history-list');
  list.innerHTML = '';
  let items = state.history.filter(item=>{
    if(historyFilter !== 'all' && item.status !== historyFilter) return false;
    if(historySearch && !((item.source+' '+item.total+' '+item.status).toLowerCase().includes(historySearch))) return false;
    return true;
  });
  if(!items.length){
    list.innerHTML = '<div class="empty-state">No scans match. Verified codes appear here — never with amounts or payment info.</div>';
    return;
  }
  items.forEach((item, idx)=>{
    const el = document.createElement('div');
    el.className = 'history-item';
    el.style.animationDelay = (idx*0.04)+'s';
    const when = item.timestamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    el.innerHTML = '<div class="top-row"><span>'+item.total+' characters read</span><span class="badge status-'+item.status+'">'+item.status+'</span></div>'+
      '<div class="meta">'+item.letters+' letters · '+item.digits+' digits · '+item.other+' other · '+(item.source==='camera'?'Camera':'Demo')+' — '+when+'</div>'+
      '<div class="bottom-row"><button class="btn btn-ghost btn-sm" data-replay-id="'+item.id+'">↺ Replay haptics</button></div>';
    list.appendChild(el);
  });
}
document.getElementById('history-search').addEventListener('input', e=>{ historySearch = e.target.value.toLowerCase(); renderHistory(); });
document.querySelectorAll('#screen-history .filter-row .pill').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('#screen-history .filter-row .pill').forEach(b=>b.setAttribute('aria-pressed', b===btn?'true':'false'));
    historyFilter = btn.dataset.filter; renderHistory();
  });
});
document.getElementById('history-list').addEventListener('click', (e)=>{
  const btn = e.target.closest('[data-replay-id]');
  if(!btn) return;
  const item = state.history.find(h=>h.id == btn.dataset.replayId);
  if(!item) return;
  playScreenPhysics();
  let i = 0;
  const chars = (item.text||'').split('');
  function step(){
    if(i>=chars.length || i>6) return;
    vibratePattern(quickPreviewPattern(patternFor(chars[i])));
    i++;
    setTimeout(step, 260);
  }
  step();
  announce('Replaying a quick haptic preview for this scan');
});

/* ============================================================
   GUIDED DEMO — cinematic, uses the same Braille engine
   ============================================================ */
function wait2(ms){ return new Promise(res=>setTimeout(res, ms)); }
function buildTimeline(n){
  const tl = document.getElementById('demo-timeline');
  tl.innerHTML = '';
  for(let i=0;i<n;i++){ const seg=document.createElement('div'); seg.className='seg'; seg.innerHTML='<i></i>'; tl.appendChild(seg); }
}
function setTimelineProgress(index, pct){
  const segs = document.querySelectorAll('#demo-timeline .seg i');
  segs.forEach((s,i)=>{ if(i<index) s.style.width='100%'; else if(i===index) s.style.width=pct+'%'; else s.style.width='0%'; });
}
async function runDemo(){
  state.demo.cancelled = false;
  state.demo.running = true;
  document.getElementById('demo-banner').hidden = false;
  document.getElementById('btn-demo-start').parentElement.hidden = true;
  document.getElementById('demo-stop-row').hidden = false;

  const narrative = [
    { icon:'✨', status:'Welcome to BraillePay', caption:'A blind-friendly way to verify any QR code — through sound and touch, never by giving away the answer.', ms:2000 },
    { icon:'▣', status:'Locking onto a QR code…', caption:'The camera finds the code, locks the frame, and a fully simulated verification runs — no real payment involved.', ms:2000 },
    { icon:'✓', status:'Verification simulated', caption:'Merchant, amount, and reference all animate through their own check — purely illustrative for this demo.', ms:1800 }
  ];
  buildTimeline(narrative.length + 2);
  for(let n=0; n<narrative.length; n++){
    if(state.demo.cancelled) return;
    const s = narrative[n];
    document.getElementById('demo-stage-icon').textContent = s.icon;
    document.getElementById('demo-status-text').textContent = s.status;
    document.getElementById('demo-caption').textContent = s.caption;
    document.getElementById('demo-progress-fill').style.width = Math.round(((n+1)/(narrative.length+2))*100)+'%';
    announce(s.status);
    const stepStart = performance.now();
    await new Promise(res=>{
      const iv = setInterval(()=>{
        const tt = Math.min(1,(performance.now()-stepStart)/s.ms);
        setTimelineProgress(n, tt*100);
        if(tt>=1){ clearInterval(iv); res(); }
      }, 60);
      state.demo._t = iv;
    });
  }
  if(state.demo.cancelled) return;
  document.getElementById('demo-stage-icon').textContent = '⠿';
  const sample = 'A1'.split('');
  const cellEl = document.getElementById('demo-cell');
  for(const ch of sample){
    if(state.demo.cancelled) return;
    document.getElementById('demo-caption').textContent = state.revealInDemo
      ? 'Watch the dots — this is "'+ch+'". Only the category is normally spoken; reveal mode is on for this demo.'
      : 'Watch the dots settle into the pattern for this character. Only the category is ever spoken out loud.';
    const token = beginPlayback();
    state.demo.token = token;
    await playOneCharacter(ch, {
      cellEl, ringEl: document.getElementById('demo-ring'), chipEl: document.getElementById('demo-chip'),
      revealChar: state.revealInDemo, rate: 1.3
    }, token);
    if(state.demo.cancelled) return;
    setTimelineProgress(narrative.length, 100);
  }
  if(state.demo.cancelled) return;
  document.getElementById('demo-stage-icon').textContent = '🎓';
  document.getElementById('demo-status-text').textContent = 'Now visiting Learning Mode…';
  document.getElementById('demo-caption').textContent = 'In Learning Mode, identities ARE spoken and dots are tappable — it is built for practice, with streaks and a mastery tracker for all 36 characters.';
  document.getElementById('demo-progress-fill').style.width = '85%';
  announce('Now visiting Learning Mode');
  setTimelineProgress(narrative.length+1, 100);
  await wait2(2000);
  if(state.demo.cancelled) return;
  document.getElementById('demo-stage-icon').textContent = '🏁';
  document.getElementById('demo-status-text').textContent = 'Demo complete!';
  document.getElementById('demo-caption').textContent = 'That is the full flow: lock, simulated verification, one-dot-at-a-time Braille readout, learning, and full accessibility controls — no camera upload, no real UPI, no banking, anywhere.';
  document.getElementById('demo-progress-fill').style.width = '100%';
  document.getElementById('demo-chip').textContent = 'Done';
  document.getElementById('demo-chip').className = 'category-chip';
  announce('Demo complete', true);
  vibratePattern([100,60,100,60,220]);
  playScreenPhysics();
  endDemo();
}
function endDemo(){
  state.demo.running = false;
  document.getElementById('btn-demo-start').parentElement.hidden = false;
  document.getElementById('demo-stop-row').hidden = true;
  document.getElementById('demo-banner').hidden = true;
}
function stopDemo(){
  state.demo.cancelled = true;
  if(state.demo.token) cancelToken(state.demo.token);
  clearTimeout(state.demo._t); clearInterval(state.demo._t);
  endDemo();
}
document.getElementById('btn-demo-start').addEventListener('click', runDemo);
document.getElementById('btn-demo-stop').addEventListener('click', ()=>{ stopDemo(); announce('Demo stopped'); });
wireHoldToReplay('demo-cell', ()=>'A', ()=>({
  cellEl: document.getElementById('demo-cell'), ringEl: document.getElementById('demo-ring'),
  chipEl: document.getElementById('demo-chip'), revealChar: state.revealInDemo
}));

/* ============================================================
   TOAST
   ============================================================ */
let toastTimer = null;
function showToast(msg, isErr){
  const el = document.getElementById('app-toast');
  el.textContent = msg;
  el.classList.toggle('err', !!isErr);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.classList.remove('show'), 3400);
}

/* ============================================================
   PIN PAD — reusable number pad, used by the lock screen (and,
   later, by payment confirmation)
   ============================================================ */
function simpleHash(str){
  let h = 0;
  for(let i=0;i<str.length;i++){ h = (Math.imul(31,h) + str.charCodeAt(i))|0; }
  return 'h'+(h>>>0).toString(16);
}
state.pinHash = simpleHash('1234');

function buildPinPad(container, opts){
  opts = opts || {};
  const length = opts.length || 4;
  container.innerHTML = '';
  container.hidden = false;
  let entered = '';
  const dotsRow = document.createElement('div');
  dotsRow.className = 'pinpad-dots';
  dotsRow.setAttribute('aria-hidden', 'true');
  for(let i=0;i<length;i++){ dotsRow.appendChild(document.createElement('span')); }
  container.appendChild(dotsRow);
  function renderDots(){ Array.from(dotsRow.children).forEach((d,i)=>d.classList.toggle('filled', i<entered.length)); }
  function pressDigit(d){
    if(entered.length>=length) return;
    entered += d; renderDots();
    if(entered.length===length){
      const val = entered; entered='';
      setTimeout(()=>{ renderDots(); opts.onSubmit && opts.onSubmit(val); }, 120);
    }
  }
  const grid = document.createElement('div');
  grid.className = 'pinpad-grid';
  grid.setAttribute('role','group');
  grid.setAttribute('aria-label','PIN entry');
  ['1','2','3','4','5','6','7','8','9'].forEach(d=>{
    const b = document.createElement('button');
    b.type='button'; b.className='pinpad-key'; b.textContent=d; b.setAttribute('aria-label','Digit '+d);
    b.addEventListener('click', ()=>{ pressDigit(d); vibrateExact(20); });
    grid.appendChild(b);
  });
  const clearBtn = document.createElement('button');
  clearBtn.type='button'; clearBtn.className='pinpad-key wide'; clearBtn.textContent='Clear'; clearBtn.setAttribute('aria-label','Clear entry');
  clearBtn.addEventListener('click', ()=>{ entered=''; renderDots(); });
  grid.appendChild(clearBtn);
  const zeroBtn = document.createElement('button');
  zeroBtn.type='button'; zeroBtn.className='pinpad-key'; zeroBtn.textContent='0'; zeroBtn.setAttribute('aria-label','Digit 0');
  zeroBtn.addEventListener('click', ()=>{ pressDigit('0'); vibrateExact(20); });
  grid.appendChild(zeroBtn);
  const delBtn = document.createElement('button');
  delBtn.type='button'; delBtn.className='pinpad-key wide'; delBtn.textContent='⌫'; delBtn.setAttribute('aria-label','Delete last digit');
  delBtn.addEventListener('click', ()=>{ entered = entered.slice(0,-1); renderDots(); });
  grid.appendChild(delBtn);
  container.appendChild(grid);
  return {
    reset(){ entered=''; renderDots(); },
    focusFirst(){ const b = grid.querySelector('button'); if(b) b.focus(); }
  };
}

/* ============================================================
   AUTH / LOCK SCREEN
   Uses real WebAuthn: registration and verification are genuine
   browser/platform-authenticator ceremonies (Touch ID, Windows
   Hello, Android fingerprint, etc.) — the OS prompt is real and
   userVerification is required, so a wrong finger/face genuinely
   fails. The one thing that's still "demo": there's no server to
   verify the cryptographic signature against, since this is a
   client-only prototype. If the platform has no authenticator, or
   WebAuthn itself fails/is cancelled, the user is always dropped
   into the PIN fallback rather than being stuck.
   ============================================================ */
const WEBAUTHN_CRED_KEY = 'braillepay_webauthn_cred_id';
function supportsWebAuthn(){
  return !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create && navigator.credentials.get);
}
function randomBytes(n){ const a = new Uint8Array(n); crypto.getRandomValues(a); return a; }
function b64encode(buf){ return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function b64decode(str){ return Uint8Array.from(atob(str), c=>c.charCodeAt(0)); }
async function registerBiometricCredential(){
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: 'BraillePay (demo)' },
      user: { id: randomBytes(16), name: 'braillepay-demo-user', displayName: 'BraillePay demo user' },
      pubKeyCredParams: [{ type:'public-key', alg:-7 }, { type:'public-key', alg:-257 }],
      authenticatorSelection: { authenticatorAttachment:'platform', userVerification:'required' },
      timeout: 60000,
      attestation: 'none'
    }
  });
  if(!cred) throw new Error('No credential returned');
  try{ localStorage.setItem(WEBAUTHN_CRED_KEY, b64encode(cred.rawId)); }catch(e){}
  return true;
}
async function verifyBiometricCredential(){
  let storedId = null;
  try{ storedId = localStorage.getItem(WEBAUTHN_CRED_KEY); }catch(e){}
  const opts = { challenge: randomBytes(32), userVerification:'required', timeout: 60000 };
  if(storedId){ opts.allowCredentials = [{ id: b64decode(storedId), type:'public-key' }]; }
  const assertion = await navigator.credentials.get({ publicKey: opts });
  if(!assertion) throw new Error('No assertion returned');
  return true;
}
function hasBiometricCredential(){ try{ return !!localStorage.getItem(WEBAUTHN_CRED_KEY); }catch(e){ return false; } }
let biometricAvailable = false;
let lockPinPadCtrl = null;
let idleTimer = null;
const IDLE_LOCK_MS = 2*60*1000;
const SESSION_TTL_MS = 30*60*1000;

(async function detectBiometric(){
  try{
    if(supportsWebAuthn() && window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable){
      biometricAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
  }catch(e){ biometricAvailable = false; }
  if(!document.getElementById('app-lock').hidden) refreshLockUI();
})();

function refreshLockUI(){
  document.getElementById('lock-biometric-row').hidden = !biometricAvailable;
  const bioBtn = document.getElementById('lock-biometric-btn');
  bioBtn.textContent = hasBiometricCredential() ? 'Unlock with biometrics' : 'Set up biometric unlock';
  if(!biometricAvailable){
    document.getElementById('lock-caption').textContent = t('lock_caption_nobio');
    showLockPinPad();
  } else {
    document.getElementById('lock-caption').textContent = t('lock_caption_bio');
  }
}
function showLockPinPad(){
  document.getElementById('lock-pin-toggle-btn').hidden = true;
  document.getElementById('lock-pin-pad').hidden = false;
  lockPinPadCtrl = buildPinPad(document.getElementById('lock-pin-pad'), {
    length: 4,
    onSubmit(pin){
      if(simpleHash(pin) === state.pinHash){ unlockApp('pin'); }
      else{
        const st = document.getElementById('lock-status');
        st.textContent = t('wrong_pin');
        st.classList.add('err');
        const inner = document.querySelector('#app-lock .lock-inner');
        inner.classList.add('lock-shake');
        setTimeout(()=>inner.classList.remove('lock-shake'), 320);
        vibrateExact(120);
        announce('Incorrect PIN, try again', true);
        lockPinPadCtrl && lockPinPadCtrl.reset();
      }
    }
  });
  lockPinPadCtrl.focusFirst();
}
function lockApp(reason){
  state.auth.unlocked = false;
  try{ sessionStorage.removeItem('braillepay_unlocked_at'); }catch(e){}
  clearTimeout(idleTimer);
  const overlay = document.getElementById('app-lock');
  overlay.hidden = false;
  document.getElementById('lock-status').textContent = '';
  document.getElementById('lock-status').classList.remove('err');
  document.getElementById('lock-pin-pad').hidden = true;
  document.getElementById('lock-pin-toggle-btn').hidden = false;
  const bioBtn = document.getElementById('lock-biometric-btn');
  bioBtn.disabled = false; bioBtn.textContent = hasBiometricCredential() ? 'Unlock with biometrics' : 'Set up biometric unlock';
  refreshLockUI();
  setTimeout(()=>{ const h = document.getElementById('lock-heading'); if(h) h.focus({preventScroll:true}); }, 30);
  if(reason === 'idle') announce(t('locked_idle'), true);
}
function unlockApp(method){
  state.auth.unlocked = true;
  try{ sessionStorage.setItem('braillepay_unlocked_at', String(Date.now())); }catch(e){}
  document.getElementById('app-lock').hidden = true;
  announce(t('unlocked'));
  vibrateExact(60);
  resetIdleTimer();
}
document.getElementById('lock-biometric-btn').addEventListener('click', async ()=>{
  const btn = document.getElementById('lock-biometric-btn');
  const st = document.getElementById('lock-status');
  if(btn.disabled) return;
  const settingUp = !hasBiometricCredential();
  btn.disabled = true; btn.textContent = settingUp ? 'Setting up…' : 'Verifying…';
  st.classList.remove('err'); st.textContent = t('verifying_bio');
  try{
    if(settingUp){ await registerBiometricCredential(); }
    else{ await verifyBiometricCredential(); }
    btn.disabled = false; btn.textContent = 'Unlock with biometrics';
    unlockApp('biometric');
  }catch(err){
    btn.disabled = false; btn.textContent = settingUp ? 'Set up biometric unlock' : 'Unlock with biometrics';
    st.textContent = t('bio_mismatch');
    st.classList.add('err');
    vibrateExact(120);
    document.getElementById('lock-pin-toggle-btn').hidden = false;
  }
});
document.getElementById('lock-pin-toggle-btn').addEventListener('click', showLockPinPad);

function resetIdleTimer(){
  clearTimeout(idleTimer);
  if(!state.autoLock || !state.auth.unlocked) return;
  idleTimer = setTimeout(()=>{ if(state.auth.unlocked) lockApp('idle'); }, IDLE_LOCK_MS);
}
document.addEventListener('pointerdown', resetIdleTimer);
document.addEventListener('keydown', resetIdleTimer);
document.addEventListener('visibilitychange', ()=>{
  document.body.classList.toggle('privacy-blur', document.hidden);
});
document.getElementById('set-autolock').addEventListener('change', e=>{
  state.autoLock = e.target.checked;
  if(state.autoLock) resetIdleTimer(); else clearTimeout(idleTimer);
});

function initAuth(){
  let restored = false;
  try{
    const t = sessionStorage.getItem('braillepay_unlocked_at');
    if(t && (Date.now() - parseInt(t,10)) < SESSION_TTL_MS) restored = true;
  }catch(e){}
  if(restored){
    state.auth.unlocked = true;
    document.getElementById('app-lock').hidden = true;
    resetIdleTimer();
  } else {
    lockApp('initial');
  }
}

/* ============================================================
   VOICE ASSISTANT — "Hey Braille"
   ============================================================ */
let audioCtx = null;
function playBeep(freq, dur){
  try{
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq || 880;
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (dur||150)/1000);
    osc.start(now);
    osc.stop(now + (dur||150)/1000 + 0.03);
  }catch(e){ /* WebAudio unsupported or blocked — vibration still gives feedback */ }
}

let recognizer = null;
let recognizerActive = false;   // true once onstart has actually fired
let isStarting = false;         // true between calling .start() and onstart/onerror firing
let recognizerShouldRun = false; // the user's intent: should Hey Braille be listening at all
let listeningForCommand = false;
let commandTimeout = null;
let lastStartAttempt = 0;
let noSpeechErrorCount = 0;
let recognitionPausedForSpeech = false; // true while our own TTS is talking, so we don't hear ourselves
let speechResumeBackstop = null;

const WAKE_PHRASE_VARIANTS = [
  'hey braille','hey brail','hey brayle','hey braylee','a braille','hey brailly', // English (misheard variants)
  'हे ब्रेल','हे ब्रैल' // Hindi / Marathi (same script, same phrase)
];
const COMMAND_MAP = [
  { screen:'scan',     patterns:['scan qr','scan code','scan a code','scan the code','open scanner','open the scanner','scan',
                                  'क्यूआर स्कैन करो','स्कैन करो','कोड स्कैन करो', 'क्यूआर स्कॅन करा','स्कॅन करा'] },
  { screen:'send',     patterns:['send money','send a payment','pay someone','make a payment','transfer money','pay',
                                  'पैसे भेजो','भुगतान करो', 'पैसे पाठवा','पेमेंट करा'] },
  { screen:'receive',  patterns:['receive money','show my qr','show my upi','my qr code','my upi id','receive'] },
  { screen:'requests', patterns:['payment requests','show requests','my requests','request money'] },
  { screen:'notifications', patterns:['show notifications','my notifications','notifications'] },
  { screen:'banks',    patterns:['show banks','open banks','banks'] },
  { screen:'balance',  patterns:['check balance','check my balance','what is my balance','show balance','my balance','balance',
                                  'show transactions','transaction history','show my transactions',
                                  'बैलेंस चेक करो','मेरा बैलेंस बताओ', 'बॅलन्स तपासा','माझी शिल्लक सांगा'] },
  { screen:'settings', patterns:['open settings','accessibility settings','settings',
                                  'सेटिंग्स खोलो', 'सेटिंग्ज उघडा'] },
  { screen:'learning', patterns:['learning mode','learn braille','practice mode','open learning',
                                  'लर्निंग मोड','ब्रेल सीखो', 'ब्रेल शिका'] },
  { screen:'history',  patterns:['scan history','open history','show history',
                                  'इतिहास दिखाओ', 'इतिहास दाखवा'] },
  { screen:'home',     patterns:['go home','home screen','open home','home',
                                  'होम जाओ','होम स्क्रीन', 'होम वर जा'] }
];
function matchCommand(text){
  const t = text.toLowerCase().replace(/[.,!?]/g,'').trim();
  let best = null, bestLen = 0;
  for(const cmd of COMMAND_MAP){
    for(const p of cmd.patterns){
      if(t.includes(p) && p.length > bestLen){ best = cmd; bestLen = p.length; }
    }
  }
  return best;
}
function stripWakePhrase(text){
  const t = text.toLowerCase();
  for(const w of WAKE_PHRASE_VARIANTS){
    const idx = t.indexOf(w);
    if(idx !== -1) return t.slice(idx + w.length).trim();
  }
  return null;
}
function getSpeechRecognitionCtor(){ return window.SpeechRecognition || window.webkitSpeechRecognition || null; }

/* ============================================================
   SPOKEN LETTER/NUMBER NORMALIZATION
   Real speech recognizers almost never transcribe a spoken single
   letter as the bare character — "vibrate B" typically comes back
   as "vibrate bee". Without this correction layer, nearly every
   single-letter command silently failed validation, which is very
   likely the actual cause of "sometimes hears, sometimes doesn't".
   ============================================================ */
const SPOKEN_LETTER_MAP = {
  a:'A', ay:'A', b:'B', be:'B', bee:'B', c:'C', sea:'C', see:'C', cee:'C',
  d:'D', dee:'D', e:'E', ee:'E', f:'F', eff:'F', g:'G', gee:'G', jee:'G',
  h:'H', aitch:'H', i:'I', eye:'I', j:'J', jay:'J', k:'K', kay:'K',
  l:'L', el:'L', ell:'L', m:'M', em:'M', n:'N', en:'N', o:'O', oh:'O',
  p:'P', pee:'P', pea:'P', q:'Q', cue:'Q', queue:'Q', r:'R', ar:'R', are:'R',
  s:'S', es:'S', ess:'S', t:'T', tee:'T', tea:'T', u:'U', you:'U', yoo:'U',
  v:'V', vee:'V', w:'W', 'double you':'W', doubleyou:'W', dubya:'W',
  x:'X', ex:'X', ecks:'X', y:'Y', why:'Y', z:'Z', zee:'Z', zed:'Z'
};
const SPOKEN_NUMBER_MAP = {
  zero:'0', one:'1', won:'1', two:'2', too:'2', to:'2', three:'3', tree:'3',
  four:'4', for:'4', fore:'4', five:'5', six:'6', sicks:'6', seven:'7',
  eight:'8', ate:'8', nine:'9'
};
function resolveSpokenToken(token, numberContext){
  const clean = (token || '').toLowerCase().trim();
  if(/^[a-z0-9]$/.test(clean)) return clean.toUpperCase(); // already a bare single character
  if(numberContext && SPOKEN_NUMBER_MAP[clean]) return SPOKEN_NUMBER_MAP[clean];
  if(!numberContext && SPOKEN_LETTER_MAP[clean]) return SPOKEN_LETTER_MAP[clean];
  // context guess was wrong (e.g. said "vibrate five" without the word "number") — try the other map too
  if(SPOKEN_LETTER_MAP[clean]) return SPOKEN_LETTER_MAP[clean];
  if(SPOKEN_NUMBER_MAP[clean]) return SPOKEN_NUMBER_MAP[clean];
  return null;
}
function normalizeSpeechText(text){
  return (text || '').toLowerCase().replace(/[.,!?]/g,'').replace(/\s+/g,' ').trim();
}

function initVoiceAssistant(){
  const Ctor = getSpeechRecognitionCtor();
  if(!Ctor){
    document.getElementById('voice-status-text').textContent = t('unsupported');
    document.getElementById('set-voice').disabled = true;
    return false;
  }
  recognizer = new Ctor();
  recognizer.continuous = true;
  recognizer.interimResults = true;
  try{ recognizer.lang = speechLangCode(); }catch(e){}
  recognizer.onstart = ()=>{ recognizerActive = true; isStarting = false; };
  recognizer.onresult = handleRecognitionResult;
  recognizer.onerror = handleRecognitionError;
  recognizer.onend = handleRecognitionEnd;
  return true;
}

/* Safe start/stop — the single choke point every restart path goes through, so there is
   never more than one live recognition instance and never an overlapping start() call. */
function safeStartRecognition(){
  if(!recognizer) return;
  if(recognizerActive || isStarting) return; // already running or already starting
  const now = Date.now();
  if(now - lastStartAttempt < 250) return; // throttle against rapid restart loops
  lastStartAttempt = now;
  isStarting = true;
  try{ recognizer.start(); }
  catch(e){
    isStarting = false;
    if(e && e.name === 'InvalidStateError') recognizerActive = true; // browser says it's already running
  }
}
function safeStopRecognition(){
  if(recognizer && (recognizerActive || isStarting)){
    try{ recognizer.abort(); }catch(e){ try{ recognizer.stop(); }catch(e2){} }
  }
  recognizerActive = false;
  isStarting = false;
}

function handleRecognitionResult(e){
  let finalText = '';
  for(let i = e.resultIndex; i < e.results.length; i++){
    if(e.results[i].isFinal) finalText += e.results[i][0].transcript + ' ';
  }
  if(!finalText) return; // interim-only — never act on a half-spoken phrase
  noSpeechErrorCount = 0;
  const lower = normalizeSpeechText(finalText);
  if(!listeningForCommand){
    const rest = stripWakePhrase(lower);
    if(rest !== null){
      onWakeDetected();
      if(rest.length > 1) handleCommandText(rest);
    }
  } else {
    handleCommandText(lower);
  }
}
function onWakeDetected(){
  vibratePattern([60,50,60]);
  playBeep(880, 130);
  listeningForCommand = true;
  document.getElementById('voice-indicator').hidden = false;
  document.getElementById('voice-indicator-text').textContent = t('listening_cmd');
  document.getElementById('voice-fab').classList.add('on');
  announce('Listening');
  clearTimeout(commandTimeout);
  commandTimeout = setTimeout(()=>{
    listeningForCommand = false;
    document.getElementById('voice-indicator-text').textContent = t('listening_wake');
    document.getElementById('voice-fab').classList.remove('on');
  }, 8000);
}
/* "Hey Braille, vibrate B" / "braille vibrate B" / "vibrate B" / "play C" / "teach me D" /
   "show me Z" / "vibrate number 5" — with spoken letter-name and number-word correction
   ("bee"->B, "sea"->C, "five"->5) applied before validation. Uses the SAME
   playLearningCharacter() as the manual grid and the automatic lesson — never a separate
   playback path. */
function matchLearningCharacterCommand(text){
  let s = normalizeSpeechText(text);
  for(const w of WAKE_PHRASE_VARIANTS){ if(s.startsWith(w)){ s = s.slice(w.length).trim(); break; } }
  s = s.replace(/^braille\s+/,'').trim();
  const m = s.match(/\b(?:vibrate|play|teach me|show me)\s+(number\s+)?([a-z0-9]+(?:\s(?:you|we))?)\b/);
  if(!m) return null;
  const numberContext = !!m[1];
  const resolved = resolveSpokenToken(m[2].trim(), numberContext);
  return { valid: !!resolved, ch: resolved || m[2].trim().toUpperCase(), heard: m[2].trim() };
}
/* Prevents the same command firing twice from overlapping interim/final recognition events. */
/* "Hey Braille, send 500 to Shivani" / "pay 200 rupees to Rahul" — parses an
   amount + a first-name fragment, resolves the name against the real demo
   users from the backend, and always stops at the Send Money confirmation
   step for an explicit Confirm — voice never executes a payment directly
   (Part 32 of the spec). */
function matchSendMoneyCommand(text){
  let s = normalizeSpeechText(text);
  for(const w of WAKE_PHRASE_VARIANTS){ if(s.startsWith(w)){ s = s.slice(w.length).trim(); break; } }
  const m = s.match(/\b(?:send|pay|transfer)\s+(?:rs\.?|rupees|₹)?\s*(\d+(?:\.\d{1,2})?)\s*(?:rupees)?\s*(?:to\s+)?([a-z]+)\b/);
  if(!m) return null;
  return { amount: parseFloat(m[1]), namePart: m[2].trim().toLowerCase() };
}
async function handleVoiceSendCommand(cmd){
  if(!state.auth.unlocked){ showToast(t('unlock_first')); announce(t('unlock_first'), true); return; }
  if(!state.auth.user){ showToast('Sign in first.', true); return; }
  showToast('Looking for "'+cmd.namePart+'"…');
  let users = [];
  try{ users = await api.getDemoUsers(); }catch(e){ showToast('BraillePay server is unavailable.', true); return; }
  const match = users.find(u =>
    u.username.toLowerCase() === cmd.namePart ||
    u.name.toLowerCase().split(' ')[0] === cmd.namePart ||
    u.name.toLowerCase().includes(cmd.namePart)
  );
  if(!match){ showToast('Could not find a demo user named "'+cmd.namePart+'".', true); announce('Could not find that recipient.', true); return; }
  if(state.auth.user && match.upi_id === state.auth.user.upi_id){ showToast('That\'s your own account.', true); return; }

  showScreen('send'); // runs resetSendFlow()
  const ok = await resolveRecipientAndContinue(match.upi_id);
  if(!ok) return;
  document.getElementById('send-amount-input').value = cmd.amount;
  document.getElementById('send-continue-amount').click();
  announce('I found '+match.name+', '+match.upi_id+'. The amount is '+cmd.amount.toLocaleString('en-IN')+' rupees. Say confirm, or press Confirm Payment.', true);
}

let lastCommandKey = '';
let lastCommandTime = 0;
function isDuplicateCommand(key){
  const now = Date.now();
  const dup = (key === lastCommandKey) && (now - lastCommandTime < 1200);
  lastCommandKey = key; lastCommandTime = now;
  return dup;
}
function handleCommandText(text){
  const learnCmd = matchLearningCharacterCommand(text);
  if(learnCmd){
    if(isDuplicateCommand('learn:'+learnCmd.ch)) return;
    clearTimeout(commandTimeout);
    listeningForCommand = false;
    document.getElementById('voice-indicator-text').textContent = t('listening_wake');
    document.getElementById('voice-fab').classList.remove('on');
    if(!state.auth.unlocked){ showToast(t('unlock_first')); announce(t('unlock_first'), true); return; }
    if(!learnCmd.valid){
      showToast(t('learning_unsupported_speech'), true);
      announce(t('learning_unsupported_speech'), true);
      return;
    }
    vibrateExact(50);
    showToast('Playing ' + learnCmd.ch);
    if(!document.getElementById('screen-learning').classList.contains('active')){
      suppressNextLearningAutoStart = true;
      showScreen('learning');
    }
    setTimeout(()=>playLearningCharacter(learnCmd.ch), 60); // small delay so the Learning screen/grid is visible first
    return;
  }
  const sendCmd = matchSendMoneyCommand(text);
  if(sendCmd){
    if(isDuplicateCommand('send:'+sendCmd.namePart+':'+sendCmd.amount)) return;
    clearTimeout(commandTimeout);
    listeningForCommand = false;
    document.getElementById('voice-indicator-text').textContent = 'Listening for "Hey Braille"…';
    document.getElementById('voice-fab').classList.remove('on');
    vibrateExact(50);
    handleVoiceSendCommand(sendCmd);
    return;
  }
  const cmd = matchCommand(text);
  if(!cmd) return; // no match yet — stay listening until the timeout window closes
  if(isDuplicateCommand('nav:'+cmd.screen)) return;
  clearTimeout(commandTimeout);
  listeningForCommand = false;
  document.getElementById('voice-indicator-text').textContent = 'Listening for "Hey Braille"…';
  document.getElementById('voice-fab').classList.remove('on');
  if(!state.auth.unlocked){ showToast(t('unlock_first')); announce(t('unlock_first'), true); return; }
  vibrateExact(50);
  showScreen(cmd.screen);
  showToast(t('opening') + (t('scr_'+cmd.screen) || SCREEN_TITLES[cmd.screen] || cmd.screen));
}
function handleRecognitionError(e){
  if(e.error === 'not-allowed' || e.error === 'service-not-allowed'){
    recognizerShouldRun = false;
    recognizerActive = false; isStarting = false;
    document.getElementById('set-voice').checked = false;
    state.voiceEnabled = false;
    document.getElementById('voice-indicator').hidden = true;
    document.getElementById('voice-fab').hidden = true;
    document.getElementById('voice-status-text').textContent = t('mic_denied');
    showToast('Microphone permission was denied — voice assistant turned off.', true);
    return;
  }
  if(e.error === 'audio-capture'){
    recognizerShouldRun = false;
    recognizerActive = false; isStarting = false;
    document.getElementById('voice-status-text').textContent = 'No microphone was found on this device.';
    showToast('No microphone detected — voice assistant turned off.', true);
    return;
  }
  if(e.error === 'no-speech'){
    noSpeechErrorCount++; // harmless — onend below restarts listening automatically
    return;
  }
  if(e.error === 'network'){
    showToast('Voice recognition network hiccup — retrying…', true);
    return; // onend restarts
  }
  // 'aborted' and anything else fall through: onend decides whether to restart
}
function handleRecognitionEnd(){
  recognizerActive = false;
  isStarting = false;
  if(recognitionPausedForSpeech) return; // will be resumed explicitly once our own TTS finishes
  if(recognizerShouldRun) safeStartRecognition();
}

/* Stops recognition while BraillePay's own speech is playing, and resumes right after —
   without this, the microphone can hear the phone's own voice output and misfire a
   "command". Hooked from speak() so it applies to every announcement in the app, not just
   voice-assistant responses (e.g. per-character Learning Mode narration). A short backstop
   timer guards against a browser never firing the utterance's onend/onerror. */
function pauseRecognitionForSpeech(){
  if(!recognizerShouldRun || !recognizer) return;
  recognitionPausedForSpeech = true;
  safeStopRecognition();
  clearTimeout(speechResumeBackstop);
  speechResumeBackstop = setTimeout(resumeRecognitionAfterSpeech, 6000);
}
function resumeRecognitionAfterSpeech(){
  if(!recognitionPausedForSpeech) return;
  recognitionPausedForSpeech = false;
  clearTimeout(speechResumeBackstop);
  if(recognizerShouldRun) safeStartRecognition();
}

async function startVoiceAssistant(){
  if(!recognizer && !initVoiceAssistant()) return false;
  try{ recognizer.lang = speechLangCode(); }catch(e){}
  if(!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    document.getElementById('voice-status-text').textContent = 'Microphone blocked: this page must be served over HTTPS or localhost to ask for microphone access.';
    showToast('Microphone blocked: page must be served over HTTPS or localhost.', true);
    return false;
  }
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
    stream.getTracks().forEach(t=>t.stop());
  }catch(e){
    showToast('Microphone permission is needed for the voice assistant.', true);
    return false;
  }
  recognizerShouldRun = true;
  safeStartRecognition();
  document.getElementById('voice-indicator').hidden = false;
  document.getElementById('voice-fab').hidden = false;
  document.getElementById('voice-indicator-text').textContent = 'Listening for "Hey Braille"…';
  document.getElementById('voice-status-text').textContent = 'On — say "Hey Braille" then a command';
  announce(t('voice_on'));
  return true;
}
function stopVoiceAssistant(){
  recognizerShouldRun = false;
  listeningForCommand = false;
  recognitionPausedForSpeech = false;
  clearTimeout(commandTimeout);
  clearTimeout(speechResumeBackstop);
  safeStopRecognition();
  document.getElementById('voice-indicator').hidden = true;
  document.getElementById('voice-fab').hidden = true;
  document.getElementById('voice-fab').classList.remove('on');
  document.getElementById('voice-status-text').textContent = 'Say the wake phrase, then a command like "scan QR" or "check balance"';
}
document.getElementById('set-voice').addEventListener('change', async (e)=>{
  try{ (audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)()).resume(); }catch(err){}
  if(e.target.checked){
    const ok = await startVoiceAssistant();
    state.voiceEnabled = !!ok;
    e.target.checked = !!ok;
  } else {
    stopVoiceAssistant();
    state.voiceEnabled = false;
  }
});
document.getElementById('voice-fab').addEventListener('click', ()=>{
  showToast('Try: "Hey Braille, scan QR" · "vibrate B" · "check balance" · "open settings"');
});

/* ============================================================
   PERSISTENCE — settings, accessibility prefs, learning progress,
   scan history, demo balance & transactions. localStorage can be
   unavailable (private browsing, blocked storage) so every call
   is wrapped and fails silently rather than crashing the app.
   ============================================================ */
const STORAGE_KEY = 'braillepay_proto_v1';
function saveState(){
  try{
    const payload = {
      speechEnabled: state.speechEnabled, hapticsEnabled: state.hapticsEnabled, contrast: state.contrast,
      reducedMotion: state.reducedMotion, revealInDemo: state.revealInDemo, speechRate: state.speechRate,
      textSize: state.textSize, intensity: state.intensity, leftHanded: state.leftHanded,
      voiceEnabled: state.voiceEnabled, autoLock: state.autoLock, language: state.language,
      mastered: Array.from(state.mastered), quiz: state.quiz,
      history: state.history,
      pinHash: state.pinHash
      // Deliberately NOT persisted here: balance, transactions. Those are
      // authoritative on the BraillePay backend (Part 30 of the spec) —
      // localStorage is only for non-sensitive UI preferences.
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }catch(e){ /* storage unavailable — app still works in-memory for this tab */ }
}
function loadPersisted(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    const saved = JSON.parse(raw);
    Object.assign(state, saved);
    state.mastered = new Set(Array.isArray(saved.mastered) ? saved.mastered : []);
    if(!saved.quiz) state.quiz = { correct:0, total:0, streak:0, currentCh:'', currentCategory:'' };
    // balance/transactions come from the backend (see refreshAccountData),
    // never from localStorage — start at a safe default until that call lands.
    state.balance = 0;
    state.transactions = [];
    if(!Array.isArray(saved.history)) state.history = [];
  }catch(e){ /* corrupted data — start fresh instead of crashing */ }
}
let saveTimer = null;
function scheduleSave(){ clearTimeout(saveTimer); saveTimer = setTimeout(saveState, 250); }
function syncSettingsUI(){
  document.getElementById('set-speech').checked = state.speechEnabled;
  document.getElementById('set-haptics').checked = state.hapticsEnabled;
  document.getElementById('set-intensity').value = Math.round(state.intensity*100);
  document.getElementById('intensity-value').textContent = Math.round(state.intensity*100)+'%';
  document.getElementById('set-contrast').checked = state.contrast;
  document.getElementById('set-motion').checked = state.reducedMotion;
  document.getElementById('set-hand').checked = state.leftHanded;
  document.getElementById('set-reveal').checked = state.revealInDemo;
  document.getElementById('set-autolock').checked = state.autoLock;
  document.querySelectorAll('[data-lang]').forEach(b=>b.setAttribute('aria-pressed', b.dataset.lang===state.language ? 'true':'false'));
  document.querySelectorAll('[data-rate]').forEach(b=>b.setAttribute('aria-pressed', parseFloat(b.dataset.rate)===state.speechRate ? 'true':'false'));
  document.getElementById('rate-value').textContent = state.speechRate.toFixed(2).replace(/0$/,'')+'×';
  document.querySelectorAll('[data-textsize]').forEach(b=>b.setAttribute('aria-pressed', b.dataset.textsize===state.textSize ? 'true':'false'));
  document.getElementById('quiz-score').textContent = 'Score: '+state.quiz.correct+' / '+state.quiz.total;
  document.getElementById('streak-badge').textContent = '🔥 Streak: '+state.quiz.streak;
}
/* persist on every meaningful settings change (in addition to whatever each control already does) */
['set-speech','set-haptics','set-contrast','set-motion','set-hand','set-reveal','set-autolock','set-voice'].forEach(id=>{
  document.getElementById(id).addEventListener('change', scheduleSave);
});
document.getElementById('set-intensity').addEventListener('change', scheduleSave);
document.querySelectorAll('[data-rate]').forEach(b=>b.addEventListener('click', scheduleSave));
document.querySelectorAll('[data-textsize]').forEach(b=>b.addEventListener('click', scheduleSave));

/* ============================================================
   SEND MONEY — validation, demo balance, payment auth gate,
   receipt with generated transaction ID / UTR
   ============================================================ */
function validateRecipientFormat(v){
  v = (v||'').trim();
  if(!v) return { ok:false, msg:'' };
  const isUpi = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,64}$/.test(v);
  if(isUpi) return { ok:true };
  return { ok:false, msg:'Enter a valid BraillePay UPI ID, e.g. name@braillepay.' };
}
const sendRecipientInput = document.getElementById('send-recipient-input');
const sendRecipientErr = document.getElementById('send-recipient-error');
const sendContinueRecipient = document.getElementById('send-continue-recipient');
function refreshRecipientUI(){
  const v = sendRecipientInput.value;
  const res = validateRecipientFormat(v);
  document.getElementById('send-recipient-card').hidden = true;
  sendContinueRecipient.disabled = !res.ok;
  sendRecipientErr.textContent = (v && !res.ok) ? res.msg : '';
}
sendRecipientInput.addEventListener('input', refreshRecipientUI);
async function populateSendDemoRecipients(){
  const row = document.getElementById('send-demo-recipients');
  if(!row) return;
  row.innerHTML = '';
  try{
    const users = await api.getDemoUsers();
    users
      .filter(u => !state.auth.user || u.upi_id !== state.auth.user.upi_id)
      .forEach(u=>{
        const chip = document.createElement('button');
        chip.className = 'preset-chip';
        chip.dataset.fill = u.upi_id;
        chip.textContent = u.upi_id;
        chip.addEventListener('click', ()=>{ sendRecipientInput.value = u.upi_id; refreshRecipientUI(); sendRecipientInput.focus(); });
        row.appendChild(chip);
      });
  }catch(e){ /* demo picker just stays empty if the backend is unreachable — manual entry still works */ }
}

const SEND_STEPS = ['recipient','amount','summary','auth','processing','success'];
function showSendStep(step){
  SEND_STEPS.forEach(s=>{ document.getElementById('send-step-'+s).hidden = (s!==step); });
  document.getElementById('send-back-btn').hidden = (step==='processing' || step==='success');
  const heading = document.getElementById('send-step-'+step);
  const focusable = heading.querySelector('input, button');
  if(focusable) setTimeout(()=>focusable.focus({preventScroll:true}), 30);
}
function resetSendFlow(){
  sendRecipientInput.value = '';
  document.getElementById('send-recipient-card').hidden = true;
  sendContinueRecipient.disabled = true;
  sendRecipientErr.textContent = '';
  document.getElementById('send-amount-input').value = '';
  document.getElementById('send-note-input').value = '';
  document.getElementById('send-amount-error').textContent = '';
  state.send = { recipient:'', recipientName:'', recipientBank:'', amount:0, note:'' };
  currentSendIdempotencyKey = null;
  showSendStep('recipient');
  populateSendDemoRecipients();
}
async function resolveRecipientAndContinue(upiId){
  const btn = document.getElementById('send-continue-recipient');
  const originalLabel = btn.textContent;
  btn.disabled = true; btn.textContent = 'Checking…';
  try{
    const result = await api.lookupUser(upiId);
    state.send.recipient = result.user.upi_id;
    state.send.recipientName = result.user.name;
    state.send.recipientBank = result.bank.name;
    document.getElementById('rp-name').textContent = result.user.name;
    document.getElementById('rp-upi').textContent = result.user.upi_id;
    document.getElementById('rp-bank').textContent = result.bank.name;
    document.getElementById('send-recipient-card').hidden = false;
    sendRecipientErr.textContent = '';
    document.getElementById('send-balance-display').textContent = '₹'+Number(state.balance).toLocaleString('en-IN');
    showSendStep('amount');
    return true;
  }catch(e){
    sendRecipientErr.textContent = e.detail || 'Recipient not found.';
    announce(sendRecipientErr.textContent, true);
    document.getElementById('send-recipient-card').hidden = true;
    return false;
  }finally{
    btn.disabled = false; btn.textContent = originalLabel;
  }
}
document.getElementById('send-continue-recipient').addEventListener('click', ()=>{
  resolveRecipientAndContinue(sendRecipientInput.value.trim().toLowerCase());
});
document.getElementById('send-amount-input').addEventListener('input', ()=>{ document.getElementById('send-amount-error').textContent=''; });
document.getElementById('send-continue-amount').addEventListener('click', ()=>{
  const raw = document.getElementById('send-amount-input').value;
  const amt = parseFloat(raw);
  const errEl = document.getElementById('send-amount-error');
  if(!raw || isNaN(amt) || amt <= 0){ errEl.textContent = 'Enter an amount greater than ₹0.'; announce(errEl.textContent, true); return; }
  if(amt > Number(state.balance)){ errEl.textContent = 'That\'s more than your balance of ₹'+Number(state.balance).toLocaleString('en-IN')+'.'; announce(errEl.textContent, true); return; }
  state.send.amount = amt;
  state.send.note = document.getElementById('send-note-input').value.trim();
  document.getElementById('sm-name').textContent = document.getElementById('rp-name').textContent;
  document.getElementById('sm-upi').textContent = document.getElementById('rp-upi').textContent;
  document.getElementById('sm-amount').textContent = '₹'+amt.toLocaleString('en-IN');
  document.getElementById('sm-note').textContent = state.send.note || '—';
  showSendStep('summary');
});
document.querySelectorAll('[data-send-back]').forEach(btn=>{
  btn.addEventListener('click', ()=>showSendStep(btn.dataset.sendBack));
});
document.getElementById('send-back-btn').addEventListener('click', ()=>{
  const current = SEND_STEPS.find(s=>!document.getElementById('send-step-'+s).hidden);
  if(current === 'recipient' || !current){ showScreen('home'); return; }
  const idx = SEND_STEPS.indexOf(current);
  showSendStep(SEND_STEPS[Math.max(0, idx-1)]);
});
let sendPinPadCtrl = null;
document.getElementById('send-continue-summary').addEventListener('click', ()=>{
  document.getElementById('send-auth-icon').textContent = '🔒';
  document.getElementById('send-auth-status').textContent = 'Confirm to pay';  // kept in English: this is a static UI label, see send-auth-caption below for the translated instruction
  document.getElementById('send-auth-status').className = 'category-chip';
  document.getElementById('send-auth-caption').textContent = t('send_confirm');
  document.getElementById('send-pin-pad').hidden = true;
  document.getElementById('send-auth-pin-btn').hidden = false;
  const bioRow = document.getElementById('send-auth-biometric');
  bioRow.hidden = !biometricAvailable || !hasBiometricCredential();
  bioRow.disabled = false; bioRow.textContent = 'Confirm with biometrics';
  if(bioRow.hidden) showSendPinPad();
  showSendStep('auth');
});
function showSendPinPad(){
  document.getElementById('send-auth-pin-btn').hidden = true;
  document.getElementById('send-pin-pad').hidden = false;
  sendPinPadCtrl = buildPinPad(document.getElementById('send-pin-pad'), {
    length: 4,
    onSubmit(pin){
      if(simpleHash(pin) === state.pinHash){ completePayment('pin'); }
      else{
        document.getElementById('send-auth-status').textContent = 'Incorrect PIN';
        document.getElementById('send-auth-status').className = 'category-chip symbol';
        document.getElementById('send-auth-caption').textContent = t('send_wrong_pin');
        vibrateExact(120);
        announce('Incorrect PIN, try again', true);
        sendPinPadCtrl && sendPinPadCtrl.reset();
      }
    }
  });
  sendPinPadCtrl.focusFirst();
}
document.getElementById('send-auth-pin-btn').addEventListener('click', showSendPinPad);
document.getElementById('send-auth-biometric').addEventListener('click', async ()=>{
  const btn = document.getElementById('send-auth-biometric');
  if(btn.disabled) return;
  btn.disabled = true; btn.textContent = 'Verifying…';
  document.getElementById('send-auth-caption').textContent = t('verifying_bio');
  try{
    await verifyBiometricCredential();
    btn.disabled = false; btn.textContent = 'Confirm with biometrics';
    completePayment('biometric');
  }catch(err){
    btn.disabled = false; btn.textContent = 'Confirm with biometrics';
    document.getElementById('send-auth-status').textContent = "Didn't match";
    document.getElementById('send-auth-status').className = 'category-chip symbol';
    document.getElementById('send-auth-caption').textContent = 'Try again, or use your PIN below.';
    vibrateExact(120);
    document.getElementById('send-auth-pin-btn').hidden = false;
  }
});
function generateTxId(){ return 'BP' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random()*900+100); }
function generateUTR(){ let n=''; for(let i=0;i<12;i++) n += Math.floor(Math.random()*10); return n; }
let currentSendIdempotencyKey = null;
let currentSendFingerprint = null;
async function completePayment(method){
  showSendStep('processing');
  // The key is kept across retries of the SAME payment (so a retry after a timeout cannot pay twice)
  // and replaced whenever recipient, amount or note changes (so it never replays a different payment).
  const fingerprint = [state.send.recipient, state.send.amount, state.send.note || ''].join('|');
  if(!currentSendIdempotencyKey || currentSendFingerprint !== fingerprint){
    currentSendIdempotencyKey = genIdempotencyKey();
    currentSendFingerprint = fingerprint;
  }
  try{
    const receipt = await api.sendPayment(state.send.recipient, state.send.amount, state.send.note, currentSendIdempotencyKey);
    const tx = receipt.transaction;
    state.balance = receipt.sender_balance_after;
    state.transactions.unshift(mapBackendTx(tx));
    scheduleSave();
    document.getElementById('rc-txid').textContent = tx.transaction_id;
    document.getElementById('rc-utr').textContent = tx.reference_id;
    document.getElementById('rc-time').textContent = new Date(tx.created_at).toLocaleString([], {dateStyle:'medium', timeStyle:'short'});
    document.getElementById('rc-balance').textContent = '₹'+Number(state.balance).toLocaleString('en-IN');
    const recipientLabel = state.send.recipientName || tx.receiver_upi;
    const caption = 'Sent ₹'+Number(tx.amount).toLocaleString('en-IN')+' to '+recipientLabel+'. This is a simulated demo transaction — no real money moved, no bank or UPI network was contacted.';
    document.getElementById('send-success-caption').textContent = caption;
    currentSendIdempotencyKey = null;
    showSendStep('success');
    vibratePattern([100,60,100,60,220]);
    announce(t('payment_success')+caption, true);
    renderBalanceScreen();
    renderHomeGreeting();
  }catch(e){
    showSendStep('summary');
    const msg = e.detail || 'BraillePay could not complete this request.';
    // A timeout or dropped connection does NOT prove the payment failed: the server may have
    // processed it. Say so; the kept idempotency key means a deliberate retry cannot pay twice.
    const unknown = e.status === 0;
    document.getElementById('send-auth-status') && (document.getElementById('send-auth-status').textContent = unknown ? 'Payment status unknown' : 'Payment failed');
    announce((unknown ? 'Payment status unknown. ' : 'Payment failed. ') + msg, true);
    showToast(msg, true);
  }
}
document.getElementById('send-repeat-receipt').addEventListener('click', ()=>{
  speak(document.getElementById('send-success-caption').textContent, {interrupt:true});
});
document.getElementById('send-share-receipt').addEventListener('click', ()=>{
  const text = 'BraillePay demo receipt — '+document.getElementById('rc-txid').textContent+' — this is a simulated transaction, not a real payment.';
  if(navigator.share){ navigator.share({ title:'BraillePay demo receipt', text }).catch(()=>{}); }
  else{ showToast('Sharing isn\'t supported in this browser — receipt details are on screen.'); }
});
document.getElementById('send-download-receipt').addEventListener('click', ()=>{
  const lines = [
    'BraillePay — DEMO RECEIPT (no real money moved)',
    'Transaction ID: '+document.getElementById('rc-txid').textContent,
    'UTR Number: '+document.getElementById('rc-utr').textContent,
    'Time: '+document.getElementById('rc-time').textContent,
    'Remaining balance: '+document.getElementById('rc-balance').textContent
  ];
  const blob = new Blob([lines.join('\n')], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'braillepay-demo-receipt.txt';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
  showToast('Demo receipt downloaded.');
});

/* ============================================================
   BALANCE & TRANSACTIONS
   ============================================================ */
function renderBalanceScreen(){
  document.getElementById('balance-main-display').textContent = '₹'+Number(state.balance).toLocaleString('en-IN');
  const list = document.getElementById('balance-tx-list');
  list.innerHTML = '';
  if(!state.transactions.length){
    const empty = document.createElement('p');
    empty.className = 'cell-caption';
    empty.textContent = t('balance_empty');
    list.appendChild(empty);
    return;
  }
  state.transactions.forEach(txn=>{
    const row = document.createElement('div');
    row.className = 'summary-card';
    row.style.marginBottom = '10px';
    const received = txn.direction === 'RECEIVED';
    const sign = received ? '+' : '-';
    const color = received ? 'var(--accent-2)' : 'var(--text)';
    row.innerHTML =
      '<div class="summary-row"><span>'+(txn.name||txn.recipient)+'</span><b style="color:'+color+';">'+sign+'₹'+Number(txn.amount).toLocaleString('en-IN')+'</b></div>'+
      '<div class="summary-row"><span>'+txn.recipient+'</span><span>'+new Date(txn.time).toLocaleDateString([], {month:'short', day:'numeric'})+'</span></div>'+
      (txn.note ? ('<div class="summary-row"><span>'+t('send_note')+'</span><span>'+txn.note+'</span></div>') : '')+
      (txn.status && txn.status !== 'SUCCESS' ? ('<div class="summary-row"><span>Status</span><span>'+txn.status+'</span></div>') : '');
    list.appendChild(row);
  });
}
document.getElementById('btn-speak-balance').addEventListener('click', ()=>{
  speak(t('balance_speak')+Number(state.balance).toLocaleString('en-IN'), {interrupt:true});
  announce('Balance ₹'+Number(state.balance).toLocaleString('en-IN'));
});
let suppressNextLearningAutoStart = false;
const originalShowScreen = showScreen;
showScreen = function(name, opts){

  if(name === 'send') resetSendFlow();
  if(name === 'balance') renderBalanceScreen();
  if(name === 'receive') loadReceiveScreen();
  if(name === 'requests') loadRequestsScreen();
  if(name === 'banks') loadBanksScreen();
  if(name === 'notifications') loadNotificationsScreen();
  if(name === 'admin') loadAdminScreen();
  if(name === 'learning'){
    const alreadyThere = document.getElementById('screen-learning').classList.contains('active');
    originalShowScreen(name, opts);
    if(!alreadyThere){
      document.getElementById('tab-browse').setAttribute('aria-selected','true');
      document.getElementById('tab-quiz').setAttribute('aria-selected','false');
      document.getElementById('learning-browse').hidden = false;
      document.getElementById('learning-quiz').hidden = true;
      if(suppressNextLearningAutoStart){ suppressNextLearningAutoStart = false; }
      else{ startAutomaticLearning(); } // always restarts from A — never resumes a previous position
    }
    return;
  }
  originalShowScreen(name, opts);
};

/* ============================================================
   BACKEND API CLIENT
   BraillePay's backend is a simulated payments API: no real
   money, no real bank/UPI network is ever contacted. Point
   API_BASE_URL at wherever you deployed backend/ (see the
   project README) — for local development the default below
   matches `uvicorn app.main:app --port 8000`.
   ============================================================ */
const API_BASE_URL = window.BRAILLEPAY_API_BASE_URL || 'https://braillepay.onrender.com';
const TOKEN_KEY = 'braillepay_session_token';

function getToken(){ try{ return sessionStorage.getItem(TOKEN_KEY); }catch(e){ return null; } }
function setToken(tok){
  try{
    if(tok) sessionStorage.setItem(TOKEN_KEY, tok);
    else sessionStorage.removeItem(TOKEN_KEY);
  }catch(e){ /* sessionStorage unavailable (private browsing) — session just won't survive reload */ }
}

class ApiError extends Error {
  constructor(status, detail){ super(detail || ('Request failed ('+status+')')); this.status = status; this.detail = detail; }
}

const API_TIMEOUT_MS = 15000;
const READ_RETRY_DELAYS_MS = [1000, 2000, 4000]; // used only for read-only (GET) requests

function sleep(ms){ return new Promise(res=>setTimeout(res, ms)); }

async function fetchWithTimeout(url, init, timeoutMs){
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), timeoutMs);
  try{
    return await fetch(url, Object.assign({}, init, { signal: controller.signal }));
  }finally{
    clearTimeout(timer);
  }
}

/*
 * Only read-only requests (GET) are retried automatically. Writes (login, payments, refunds,
 * payment requests) are NEVER repeated by the client after a timeout, because the server may
 * already have processed them. Payments carry an Idempotency-Key, so a deliberate retry by the
 * person with the same key cannot pay twice.
 */
async function apiRequest(path, opts){
  opts = opts || {};
  const method = opts.method || 'GET';
  const isRead = method === 'GET';
  const useAuth = opts.auth !== false;
  const finalHeaders = Object.assign({}, opts.headers || {});
  if(opts.body !== undefined) finalHeaders['Content-Type'] = 'application/json';
  if(useAuth){
    const tok = getToken();
    if(tok) finalHeaders['Authorization'] = 'Bearer '+tok;
  }
  const init = {
    method: method,
    headers: finalHeaders,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
  };
  const timeoutMs = opts.timeoutMs || API_TIMEOUT_MS;
  const attempts = isRead ? READ_RETRY_DELAYS_MS.length + 1 : 1;
  let resp = null;
  for(let attempt = 0; attempt < attempts; attempt++){
    try{
      resp = await fetchWithTimeout(API_BASE_URL + path, init, timeoutMs);
    }catch(networkErr){
      resp = null;
      if(attempt < attempts - 1){ await sleep(READ_RETRY_DELAYS_MS[attempt]); continue; }
      break;
    }
    const coldOrBusy = resp.status === 502 || resp.status === 503 || resp.status === 504;
    if(isRead && coldOrBusy && attempt < attempts - 1){ await sleep(READ_RETRY_DELAYS_MS[attempt]); continue; }
    break;
  }
  if(!resp){
    // Never claim a payment failed or succeeded when the server did not answer.
    throw new ApiError(0, isRead
      ? 'The BraillePay server is not responding. It may be waking up — try again in a moment.'
      : 'We could not confirm this request because the server did not respond. Check your transaction history before trying again.');
  }
  if(resp.status === 204) return null;
  let data = null;
  try{ data = await resp.json(); }catch(e){ /* empty/non-JSON body */ }
  if(!resp.ok){
    if(resp.status === 401 && useAuth) handleSessionExpired();
    const detail = (data && data.detail) ? data.detail : ('Request failed ('+resp.status+')');
    throw new ApiError(resp.status, detail);
  }
  return data;
}

function genIdempotencyKey(){
  if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'idem-'+Date.now()+'-'+Math.random().toString(36).slice(2);
}

const api = {
  login: (username, pin) => apiRequest('/api/auth/login', { method:'POST', auth:false, body:{ username, pin } }),
  logout: () => apiRequest('/api/auth/logout', { method:'POST' }).catch(()=>{}),
  getMe: () => apiRequest('/api/auth/me'),
  getDemoUsers: () => apiRequest('/api/auth/demo-users', { auth:false }),
  getBalance: () => apiRequest('/api/accounts/balance'),
  getBanks: () => apiRequest('/api/banks', { auth:false }),
  getDemoStats: () => apiRequest('/api/demo/stats'),
  lookupUser: (upiId) => apiRequest('/api/users/lookup?upi_id='+encodeURIComponent(upiId)),
  sendPayment: (receiverUpi, amount, note, idempotencyKey) => apiRequest('/api/payments/send', {
    method:'POST',
    body:{ receiver_upi: receiverUpi, amount: amount, note: note || undefined },
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}
  }),
  refundPayment: (transactionId) => apiRequest('/api/payments/'+encodeURIComponent(transactionId)+'/refund', { method:'POST' }),
  getTransactions: (params) => {
    const qs = params ? ('?'+new URLSearchParams(params).toString()) : '';
    return apiRequest('/api/transactions'+qs);
  },
  getTransaction: (id) => apiRequest('/api/transactions/'+encodeURIComponent(id)),
  getMyQR: () => apiRequest('/api/qr/my'),
  getDemoQRList: () => apiRequest('/api/qr/demo-list', { auth:false }),
  createPaymentRequest: (payerUpi, amount, note) => apiRequest('/api/payment-requests', { method:'POST', body:{ payer_upi: payerUpi, amount: amount, note: note || undefined } }),
  getPaymentRequests: (direction) => apiRequest('/api/payment-requests'+(direction?('?direction='+direction):'')),
  payPaymentRequest: (id) => apiRequest('/api/payment-requests/'+encodeURIComponent(id)+'/pay', { method:'POST' }),
  declinePaymentRequest: (id) => apiRequest('/api/payment-requests/'+encodeURIComponent(id)+'/decline', { method:'POST' }),
  getNotifications: () => apiRequest('/api/notifications'),
  markNotificationRead: (id) => apiRequest('/api/notifications/'+encodeURIComponent(id)+'/read', { method:'POST' }),
  resetDemo: () => apiRequest('/api/demo/reset', { method:'POST', auth:false }),
  webauthnRegisterOptions: () => apiRequest('/api/webauthn/register/options', { method:'POST' }),
  webauthnRegisterVerify: (credential) => apiRequest('/api/webauthn/register/verify', { method:'POST', body:{ credential } }),
  webauthnLoginOptions: (username) => apiRequest('/api/webauthn/login/options', { method:'POST', auth:false, body:{ username } }),
  webauthnLoginVerify: (credential) => apiRequest('/api/webauthn/login/verify', { method:'POST', auth:false, body:{ credential } })
};

function handleSessionExpired(){
  setToken(null);
  state.auth.user = null;
  try{ showToast('Session expired — please sign in again.'); }catch(e){}
  try{ showScreen('login'); }catch(e){}
}

/* ============================================================
   SESSION / LOGIN
   Real backend authentication, layered on top of (and separate
   from) the existing local app-lock (device PIN/biometric) above
   — that lock is a per-device convenience; this is who you are.
   ============================================================ */
function updateAccountSettingsLine(){
  const el = document.getElementById('settings-account-line');
  if(!el) return;
  el.textContent = state.auth.user
    ? ('Signed in as '+state.auth.user.name+' ('+state.auth.user.upi_id+')')
    : 'Not signed in';
}

function renderHomeGreeting(){
  const heading = document.getElementById('main-heading');
  if(heading && state.auth.user) heading.textContent = 'Hello '+state.auth.user.name.split(' ')[0]+' 👋';
  const balLine = document.getElementById('home-balance-line');
  if(balLine) balLine.textContent = '₹'+Number(state.balance).toLocaleString('en-IN');
  updateAccountSettingsLine();
}

function mapBackendTx(tx){
  const isSent = tx.direction === 'SENT';
  let counterpart = isSent ? tx.receiver_upi : tx.sender_upi;
  if(tx.description && tx.description.includes(' paid ')){
    const parts = tx.description.split(' paid ');
    counterpart = isSent ? parts[1] : parts[0];
  }
  return {
    id: tx.transaction_id, utr: tx.reference_id, amount: tx.amount,
    recipient: isSent ? tx.receiver_upi : tx.sender_upi,
    name: counterpart, note: tx.note, time: tx.created_at,
    direction: tx.direction, status: tx.status, type: tx.type
  };
}

async function refreshAccountData(){
  try{
    const bal = await api.getBalance();
    state.balance = bal.balance;
  }catch(e){ /* keep last known balance rather than crashing the UI */ }
  try{
    const txResp = await api.getTransactions({ limit: '50' });
    state.transactions = txResp.items.map(mapBackendTx);
  }catch(e){ /* history just stays as last known */ }
  renderHomeGreeting();
  refreshNotificationBadge();
  checkAdminAvailable();
  const balScreen = document.getElementById('screen-balance');
  if(balScreen && balScreen.classList.contains('active')) renderBalanceScreen();
}

async function populateDemoUserPicker(){
  const row = document.getElementById('login-demo-users');
  if(!row) return;
  row.innerHTML = '';
  try{
    const users = await api.getDemoUsers();
    users.forEach(u=>{
      const btn = document.createElement('button');
      btn.className = 'preset-chip';
      btn.type = 'button';
      btn.textContent = u.name.split(' ')[0];
      btn.setAttribute('aria-label', 'Fill demo login for '+u.name);
      btn.addEventListener('click', ()=>{
        document.getElementById('login-username-input').value = u.username;
        document.getElementById('login-pin-input').value = '1234';
        document.getElementById('login-submit-btn').focus();
      });
      row.appendChild(btn);
    });
  }catch(e){ /* backend unreachable — quick-login list stays empty, manual entry still works */ }
}

async function doLogin(username, pin){
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-submit-btn');
  errEl.textContent = '';
  if(!username || !pin){ errEl.textContent = 'Enter a username and PIN.'; return; }
  btn.disabled = true; btn.textContent = 'Signing in…';
  try{
    const resp = await api.login(username, pin);
    setToken(resp.access_token);
    state.auth.user = resp.user;
    await refreshAccountData();
    await populateSendDemoRecipients();
    announce('Signed in as '+resp.user.name, true);
    showScreen('home');
  }catch(e){
    errEl.textContent = e.detail || 'Sign in failed.';
    announce(errEl.textContent, true);
  }finally{
    btn.disabled = false; btn.textContent = 'Sign in';
  }
}
document.getElementById('login-submit-btn').addEventListener('click', ()=>{
  doLogin(document.getElementById('login-username-input').value.trim(), document.getElementById('login-pin-input').value.trim());
});
document.getElementById('login-pin-input').addEventListener('keydown', (e)=>{ if(e.key==='Enter') document.getElementById('login-submit-btn').click(); });
document.getElementById('login-username-input').addEventListener('keydown', (e)=>{ if(e.key==='Enter') document.getElementById('login-pin-input').focus(); });

document.getElementById('settings-signout-btn').addEventListener('click', async ()=>{
  await api.logout();
  setToken(null);
  state.auth.user = null;
  state.balance = 0;
  state.transactions = [];
  updateAccountSettingsLine();
  showToast('Signed out.');
  showScreen('login');
  document.getElementById('login-username-input').value = '';
  document.getElementById('login-pin-input').value = '';
});

async function tryRestoreSession(){
  const tok = getToken();
  if(!tok) return false;
  try{
    const me = await api.getMe();
    state.auth.user = me;
    await refreshAccountData();
    return true;
  }catch(e){
    setToken(null);
    return false;
  }
}

/* ============================================================
   SERVER-SIDE WEBAUTHN (Part 25)
   Distinct from the pre-existing LOCAL device lock above (which
   never talks to a server). This registers/verifies a real
   platform authenticator against the BraillePay backend.
   ============================================================ */
function base64urlToBuffer(base64url){
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++) buffer[i] = raw.charCodeAt(i);
  return buffer.buffer;
}
function bufferToBase64url(buffer){
  const bytes = new Uint8Array(buffer);
  let str = '';
  for(let i=0;i<bytes.length;i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function prepareCreationOptions(opts){
  opts.challenge = base64urlToBuffer(opts.challenge);
  opts.user.id = base64urlToBuffer(opts.user.id);
  if(opts.excludeCredentials){
    opts.excludeCredentials = opts.excludeCredentials.map(c => Object.assign({}, c, { id: base64urlToBuffer(c.id) }));
  }
  return opts;
}
function prepareRequestOptions(opts){
  opts.challenge = base64urlToBuffer(opts.challenge);
  if(opts.allowCredentials){
    opts.allowCredentials = opts.allowCredentials.map(c => Object.assign({}, c, { id: base64urlToBuffer(c.id) }));
  }
  return opts;
}
function credentialToJSON(cred){
  if(cred.response.attestationObject){
    return {
      id: cred.id, rawId: bufferToBase64url(cred.rawId), type: cred.type,
      response: {
        clientDataJSON: bufferToBase64url(cred.response.clientDataJSON),
        attestationObject: bufferToBase64url(cred.response.attestationObject),
        transports: cred.response.getTransports ? cred.response.getTransports() : []
      }
    };
  }
  return {
    id: cred.id, rawId: bufferToBase64url(cred.rawId), type: cred.type,
    response: {
      clientDataJSON: bufferToBase64url(cred.response.clientDataJSON),
      authenticatorData: bufferToBase64url(cred.response.authenticatorData),
      signature: bufferToBase64url(cred.response.signature),
      userHandle: cred.response.userHandle ? bufferToBase64url(cred.response.userHandle) : null
    }
  };
}
async function registerPasskey(){
  const statusEl = document.getElementById('settings-passkey-status');
  if(!window.PublicKeyCredential){ showToast('This browser does not support WebAuthn.', true); return; }
  if(!state.auth.user){ showToast('Sign in first.', true); return; }
  const btn = document.getElementById('settings-register-passkey-btn');
  btn.disabled = true; btn.textContent = 'Registering…';
  try{
    const optionsJson = await api.webauthnRegisterOptions();
    const publicKey = prepareCreationOptions(optionsJson);
    const cred = await navigator.credentials.create({ publicKey });
    if(!cred) throw new Error('cancelled');
    await api.webauthnRegisterVerify(credentialToJSON(cred));
    statusEl.textContent = 'Passkey registered on this device.';
    showToast('Passkey registered.');
    announce('Passkey registered for this device.', true);
  }catch(e){
    const msg = (e && e.detail) ? e.detail : 'Could not register a passkey on this device.';
    statusEl.textContent = msg;
    showToast(msg, true);
  }finally{
    btn.disabled = false; btn.textContent = 'Register passkey';
  }
}
document.getElementById('settings-register-passkey-btn').addEventListener('click', registerPasskey);

async function loginWithPasskey(){
  const username = document.getElementById('login-username-input').value.trim();
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  if(!username){ errEl.textContent = 'Enter your username first, then use a passkey.'; return; }
  if(!window.PublicKeyCredential){ errEl.textContent = 'This browser does not support passkeys.'; return; }
  const btn = document.getElementById('login-passkey-btn');
  btn.disabled = true; btn.textContent = 'Waiting for passkey…';
  try{
    const optionsJson = await api.webauthnLoginOptions(username);
    const publicKey = prepareRequestOptions(optionsJson);
    const assertion = await navigator.credentials.get({ publicKey });
    if(!assertion) throw new Error('cancelled');
    const resp = await api.webauthnLoginVerify(credentialToJSON(assertion));
    setToken(resp.access_token);
    state.auth.user = resp.user;
    await refreshAccountData();
    await populateSendDemoRecipients();
    announce('Signed in with passkey as '+resp.user.name, true);
    showScreen('home');
  }catch(e){
    errEl.textContent = (e && e.detail) ? e.detail : 'Passkey sign-in failed — you can still sign in with your PIN.';
    announce(errEl.textContent, true);
  }finally{
    btn.disabled = false; btn.textContent = 'Use a passkey instead';
  }
}
document.getElementById('login-passkey-btn').addEventListener('click', loginWithPasskey);

/* ============================================================
   RECEIVE MONEY
   ============================================================ */
async function loadReceiveScreen(){
  const nameEl = document.getElementById('receive-name');
  const upiEl = document.getElementById('receive-upi');
  const bankEl = document.getElementById('receive-bank');
  const imgEl = document.getElementById('receive-qr-img');
  if(state.auth.user){
    nameEl.textContent = state.auth.user.name;
    upiEl.textContent = state.auth.user.upi_id;
  }
  try{
    const qr = await api.getMyQR();
    if(qr.image_base64) imgEl.src = 'data:image/png;base64,'+qr.image_base64;
    nameEl.textContent = qr.payload.name || nameEl.textContent;
    upiEl.textContent = qr.upi_id;
  }catch(e){ /* QR image just won't render if the backend is unreachable */ }
  try{
    const bal = await api.getBalance();
    bankEl.textContent = bal.bank.name + ' · ' + bal.account.status;
  }catch(e){ bankEl.textContent = ''; }
}
document.getElementById('receive-copy-upi').addEventListener('click', async ()=>{
  const upi = document.getElementById('receive-upi').textContent;
  try{ await navigator.clipboard.writeText(upi); showToast('UPI ID copied.'); announce('UPI ID copied to clipboard.'); }
  catch(e){ showToast('Could not copy — select and copy manually: '+upi, true); }
});
document.getElementById('receive-download-qr').addEventListener('click', ()=>{
  const img = document.getElementById('receive-qr-img');
  if(!img.src){ showToast('QR not loaded yet.', true); return; }
  const a = document.createElement('a');
  a.href = img.src;
  a.download = 'braillepay-qr-'+(state.auth.user ? state.auth.user.username : 'demo')+'.png';
  document.body.appendChild(a); a.click(); a.remove();
});
document.getElementById('receive-share-qr').addEventListener('click', async ()=>{
  const upi = document.getElementById('receive-upi').textContent;
  const shareText = 'Send me a simulated BraillePay payment to '+upi;
  if(navigator.share){
    try{ await navigator.share({ title:'BraillePay', text: shareText }); }catch(e){ /* user cancelled */ }
  }else{
    try{ await navigator.clipboard.writeText(shareText); showToast('Share text copied.'); }
    catch(e){ showToast(shareText); }
  }
});

/* ============================================================
   PAYMENT REQUESTS
   ============================================================ */
function renderRequestRow(req, kind){
  const row = document.createElement('div');
  row.className = 'summary-card';
  row.style.marginBottom = '10px';
  const other = kind === 'incoming' ? req.requester_name : req.payer_name;
  const otherUpi = kind === 'incoming' ? req.requester_upi : req.payer_upi;
  row.innerHTML =
    '<div class="summary-row"><span>'+other+'</span><b>₹'+Number(req.amount).toLocaleString('en-IN')+'</b></div>'+
    '<div class="summary-row"><span>'+otherUpi+'</span><span>'+req.status+'</span></div>'+
    (req.note ? ('<div class="summary-row"><span>Note</span><span>'+req.note+'</span></div>') : '');
  if(kind === 'incoming' && req.status === 'PENDING'){
    const btnRow = document.createElement('div');
    btnRow.className = 'btn-row';
    const payBtn = document.createElement('button');
    payBtn.className = 'btn btn-primary'; payBtn.textContent = 'Pay';
    payBtn.addEventListener('click', async ()=>{
      payBtn.disabled = true; payBtn.textContent = 'Paying…';
      try{
        await api.payPaymentRequest(req.request_id);
        showToast('Paid ₹'+Number(req.amount).toLocaleString('en-IN')+' to '+other+'.');
        announce('Payment request paid.', true);
        await refreshAccountData();
        await loadRequestsScreen();
      }catch(e){
        showToast(e.detail || 'Could not pay this request.', true);
        payBtn.disabled = false; payBtn.textContent = 'Pay';
      }
    });
    const declineBtn = document.createElement('button');
    declineBtn.className = 'btn btn-secondary'; declineBtn.textContent = 'Decline';
    declineBtn.addEventListener('click', async ()=>{
      declineBtn.disabled = true;
      try{ await api.declinePaymentRequest(req.request_id); showToast('Request declined.'); await loadRequestsScreen(); }
      catch(e){ showToast(e.detail || 'Could not decline this request.', true); declineBtn.disabled = false; }
    });
    btnRow.appendChild(payBtn); btnRow.appendChild(declineBtn);
    row.appendChild(btnRow);
  }
  return row;
}
async function loadRequestsScreen(){
  const incomingEl = document.getElementById('req-incoming-list');
  const outgoingEl = document.getElementById('req-outgoing-list');
  incomingEl.innerHTML = '<p class="cell-caption">Loading…</p>';
  outgoingEl.innerHTML = '<p class="cell-caption">Loading…</p>';
  try{
    const [incoming, outgoing] = await Promise.all([
      api.getPaymentRequests('incoming'), api.getPaymentRequests('outgoing')
    ]);
    incomingEl.innerHTML = '';
    if(!incoming.length) incomingEl.innerHTML = '<p class="cell-caption">Nothing waiting on you.</p>';
    incoming.forEach(r => incomingEl.appendChild(renderRequestRow(r, 'incoming')));
    outgoingEl.innerHTML = '';
    if(!outgoing.length) outgoingEl.innerHTML = '<p class="cell-caption">You haven\'t requested anything.</p>';
    outgoing.forEach(r => outgoingEl.appendChild(renderRequestRow(r, 'outgoing')));
  }catch(e){
    incomingEl.innerHTML = '<p class="cell-caption" style="color:var(--danger);">Could not load requests.</p>';
    outgoingEl.innerHTML = '';
  }
  populateRequestDemoPayers();
}
async function populateRequestDemoPayers(){
  const row = document.getElementById('req-demo-payers');
  row.innerHTML = '';
  try{
    const users = await api.getDemoUsers();
    users.filter(u => !state.auth.user || u.upi_id !== state.auth.user.upi_id).forEach(u=>{
      const chip = document.createElement('button');
      chip.className = 'preset-chip'; chip.type = 'button'; chip.textContent = u.upi_id;
      chip.addEventListener('click', ()=>{ document.getElementById('req-payer-input').value = u.upi_id; });
      row.appendChild(chip);
    });
  }catch(e){ /* picker just stays empty */ }
}
document.getElementById('req-create-btn').addEventListener('click', async ()=>{
  const payer = document.getElementById('req-payer-input').value.trim().toLowerCase();
  const amount = parseFloat(document.getElementById('req-amount-input').value);
  const note = document.getElementById('req-note-input').value.trim();
  const errEl = document.getElementById('req-create-error');
  errEl.textContent = '';
  if(!payer){ errEl.textContent = 'Enter a UPI ID to request from.'; return; }
  if(!amount || amount <= 0){ errEl.textContent = 'Enter an amount greater than ₹0.'; return; }
  const btn = document.getElementById('req-create-btn');
  btn.disabled = true; btn.textContent = 'Sending…';
  try{
    await api.createPaymentRequest(payer, amount, note);
    document.getElementById('req-payer-input').value = '';
    document.getElementById('req-amount-input').value = '';
    document.getElementById('req-note-input').value = '';
    showToast('Request sent.');
    announce('Payment request sent.', true);
    await loadRequestsScreen();
  }catch(e){
    errEl.textContent = e.detail || 'Could not send this request.';
  }finally{
    btn.disabled = false; btn.textContent = 'Send request';
  }
});

/* ============================================================
   BANKS
   ============================================================ */
async function loadBanksScreen(){
  const el = document.getElementById('banks-list');
  el.innerHTML = '<p class="cell-caption">Loading…</p>';
  try{
    const banks = await api.getBanks();
    el.innerHTML = '';
    banks.forEach(b=>{
      const row = document.createElement('div');
      row.className = 'summary-card';
      row.style.marginBottom = '10px';
      row.innerHTML =
        '<div class="summary-row"><span style="font-weight:700;">'+b.bank.name+'</span><span class="category-chip">DEMO BANK</span></div>'+
        '<div class="summary-row"><span>Code</span><span>'+b.bank.code+'</span></div>'+
        '<div class="summary-row"><span>IFSC</span><span>'+b.bank.ifsc+'</span></div>'+
        '<div class="summary-row"><span>Demo accounts</span><span>'+b.account_count+'</span></div>'+
        '<div class="summary-row"><span>Simulated volume moved</span><span>₹'+Number(b.total_transaction_volume).toLocaleString('en-IN')+'</span></div>';
      el.appendChild(row);
    });
  }catch(e){
    el.innerHTML = '<p class="cell-caption" style="color:var(--danger);">Could not load banks — is the BraillePay server running?</p>';
  }
}

/* ============================================================
   NOTIFICATIONS
   ============================================================ */
async function refreshNotificationBadge(){
  const sub = document.getElementById('home-notif-sub');
  if(!sub) return;
  try{
    const resp = await api.getNotifications();
    sub.textContent = resp.unread_count > 0 ? (resp.unread_count+' unread') : 'All caught up';
  }catch(e){ /* badge just won't update if unreachable */ }
}
async function loadNotificationsScreen(){
  const el = document.getElementById('notif-list');
  el.innerHTML = '<p class="cell-caption">Loading…</p>';
  try{
    const resp = await api.getNotifications();
    document.getElementById('notif-screen-sub').textContent =
      resp.unread_count > 0 ? (resp.unread_count+' unread notification'+(resp.unread_count===1?'':'s')) : 'All caught up';
    el.innerHTML = '';
    if(!resp.items.length){ el.innerHTML = '<p class="cell-caption">No notifications yet.</p>'; return; }
    resp.items.forEach(n=>{
      const row = document.createElement('div');
      row.className = 'summary-card';
      row.style.marginBottom = '10px';
      if(!n.read) row.style.borderColor = 'var(--accent)';
      row.innerHTML =
        '<div class="summary-row"><span style="font-weight:700;">'+n.title+'</span><span class="cell-caption">'+new Date(n.created_at).toLocaleString([], {dateStyle:'medium', timeStyle:'short'})+'</span></div>'+
        '<div class="summary-row"><span>'+n.message+'</span></div>';
      if(!n.read){
        const btnRow = document.createElement('div');
        btnRow.className = 'btn-row';
        const readBtn = document.createElement('button');
        readBtn.className = 'btn btn-ghost btn-sm'; readBtn.textContent = 'Mark read';
        readBtn.addEventListener('click', async ()=>{
          readBtn.disabled = true;
          try{ await api.markNotificationRead(n.notification_id); await loadNotificationsScreen(); await refreshNotificationBadge(); }
          catch(e){ readBtn.disabled = false; }
        });
        btnRow.appendChild(readBtn);
        row.appendChild(btnRow);
      }
      el.appendChild(row);
    });
  }catch(e){
    el.innerHTML = '<p class="cell-caption" style="color:var(--danger);">Could not load notifications.</p>';
  }
}

/* ============================================================
   DEMO ADMIN DASHBOARD (Part 34) — demo-mode only; the nav card
   stays hidden until we confirm the backend actually exposes it.
   ============================================================ */
async function checkAdminAvailable(){
  try{
    await api.getDemoStats();
    const card = document.getElementById('nav-card-admin');
    if(card) card.hidden = false;
  }catch(e){ /* not in demo mode, or backend unreachable — card stays hidden */ }
}
async function loadAdminScreen(){
  const statsEl = document.getElementById('admin-stats');
  const txEl = document.getElementById('admin-recent-tx');
  statsEl.innerHTML = '<p class="cell-caption">Loading…</p>';
  txEl.innerHTML = '';
  try{
    const s = await api.getDemoStats();
    statsEl.innerHTML =
      '<div class="summary-card">'+
      '<div class="summary-row"><span>Total users</span><b>'+s.total_users+'</b></div>'+
      '<div class="summary-row"><span>Total banks</span><b>'+s.total_banks+'</b></div>'+
      '<div class="summary-row"><span>Total demo balance</span><b>₹'+Number(s.total_demo_balance).toLocaleString('en-IN')+'</b></div>'+
      '<div class="summary-row"><span>Total transactions</span><b>'+s.total_transactions+'</b></div>'+
      '<div class="summary-row"><span>Successful payments</span><b>'+s.successful_payments+'</b></div>'+
      '<div class="summary-row"><span>Failed payments</span><b>'+s.failed_payments+'</b></div>'+
      '<div class="summary-row"><span>Total money moved</span><b>₹'+Number(s.total_money_sent).toLocaleString('en-IN')+'</b></div>'+
      '</div>';
    s.recent_transactions.forEach(tx=>{
      const row = document.createElement('div');
      row.className = 'summary-card';
      row.style.marginBottom = '10px';
      row.innerHTML =
        '<div class="summary-row"><span>'+tx.sender_upi+' → '+tx.receiver_upi+'</span><b>₹'+Number(tx.amount).toLocaleString('en-IN')+'</b></div>'+
        '<div class="summary-row"><span>'+tx.type+'</span><span>'+tx.status+'</span></div>';
      txEl.appendChild(row);
    });
  }catch(e){
    statsEl.innerHTML = '<p class="cell-caption" style="color:var(--danger);">Demo dashboard is unavailable (not in demo mode, or the server is unreachable).</p>';
  }
}
document.getElementById('admin-reset-btn').addEventListener('click', async ()=>{
  if(!confirm('Reset all demo accounts and transactions?')) return;
  const btn = document.getElementById('admin-reset-btn');
  btn.disabled = true; btn.textContent = 'Resetting…';
  try{
    await api.resetDemo();
    showToast('Demo data reset.');
    announce('Demo data has been reset.', true);
    await refreshAccountData();
    await loadAdminScreen();
  }catch(e){
    showToast(e.detail || 'Could not reset demo data.', true);
  }finally{
    btn.disabled = false; btn.textContent = 'Reset Demo Data';
  }
});

/* ============================================================
   INIT — every step runs in isolation. A failure in any one
   subsystem (storage, speech, WebAuthn, voice assistant, etc.)
   is caught, logged, and skipped rather than being allowed to
   stop every step after it. The app must always reach Home.
   ============================================================ */
const startupErrors = [];
function safeInit(label, fn){
  try{ fn(); }
  catch(e){
    console.error('[BraillePay startup] "'+label+'" failed — continuing without it:', e);
    startupErrors.push(label);
  }
}

safeInit('Load saved data', loadPersisted);
safeInit('Apply settings', applySettingsToDom);
safeInit('Sync settings UI', syncSettingsUI);
safeInit('Apply language', applyLanguage);
safeInit('Build learning grid', buildCharGrid);
safeInit('Update mastery display', updateMastery);
safeInit('Render scan history', renderHistory);
safeInit('Render balance', renderBalanceScreen);
safeInit('Populate demo login picker', populateDemoUserPicker);

/* ---- Render free-tier cold start: ping /health on boot with backoff, without blocking the app ---- */
const WAKE_DELAYS_MS = [1000, 2000, 4000, 8000, 15000, 15000];
let backendWaking = false;
let backendReady = false;
function setBackendStatus(message, showRetry){
  const banner = document.getElementById('backend-status');
  if(!banner) return;
  banner.hidden = false;
  document.getElementById('backend-status-text').textContent = message;
  document.getElementById('backend-retry-btn').hidden = !showRetry;
}
/* a successful /health response means the server is awake; it says nothing about any payment */
async function pingBackend(){
  try{
    const resp = await fetchWithTimeout(API_BASE_URL + '/health', { method:'GET' }, 10000);
    return resp.ok;
  }catch(e){ return false; }
}
async function waitForBackend(){
  if(backendWaking) return backendReady;
  backendWaking = true;
  try{
    for(let attempt = 0; attempt <= WAKE_DELAYS_MS.length; attempt++){
      setBackendStatus(attempt === 0
        ? 'Connecting to the BraillePay server…'
        : 'Waking up the BraillePay server (attempt '+(attempt+1)+'). Free hosting can take up to a minute.', false);
      if(await pingBackend()){
        backendReady = true;
        setBackendStatus('BraillePay server is ready.', false);
        liveRegion.textContent = 'BraillePay server is ready.';
        setTimeout(()=>{ const b = document.getElementById('backend-status'); if(b && backendReady) b.hidden = true; }, 2500);
        return true;
      }
      if(attempt < WAKE_DELAYS_MS.length) await sleep(WAKE_DELAYS_MS[attempt]);
    }
    setBackendStatus('The BraillePay server is still not responding. Check your connection, then press Retry now.', true);
    liveRegion.textContent = 'The BraillePay server is not responding. Press Retry now to try again.';
    return false;
  }finally{
    backendWaking = false;
  }
}
document.getElementById('backend-retry-btn').addEventListener('click', ()=>{ waitForBackend(); });
waitForBackend();

(async function bootSession(){
  try{
    const restored = await tryRestoreSession();
    if(restored){
      await populateSendDemoRecipients();
      safeInit('Show splash screen', ()=>showScreen('splash', {silent:true}));
      safeInit('Authentication / lock screen', initAuth);
    }else{
      showScreen('login', {silent:true});
      const first = document.getElementById('login-username-input');
      if(first) first.focus({preventScroll:true});
    }
  }catch(e){
    console.error('[BraillePay startup] Session restore failed — showing login:', e);
    try{ showScreen('login', {silent:true}); }catch(e2){}
  }
})();

// Voice synthesis (Hindi/Marathi/English voice selection) is optional — if the Web Speech
// API is missing or throws, the rest of the app (haptics, visuals, everything else) must
// still work. See requirement: "if voice is unavailable, the app must still work with haptics."
safeInit('Voice/speech engine', ()=>{
  if(!('speechSynthesis' in window)) return;
  refreshVoiceCache();
  try{ speechSynthesis.onvoiceschanged = refreshVoiceCache; }catch(e){}
  // Some Android/WebView browsers never fire onvoiceschanged reliably — poll briefly as a fallback
  // so the voice list (and the Settings display) still populate a moment after load.
  let voicePollAttempts = 0;
  const voicePoll = setInterval(()=>{
    voicePollAttempts++;
    if(cachedVoices.length > 0 || voicePollAttempts > 10){ clearInterval(voicePoll); return; }
    refreshVoiceCache();
  }, 300);
});

// "Hey Braille" auto-start on load, only if the user had it enabled last session. Also
// optional — if SpeechRecognition/mic access fails, the app must still be fully usable.
safeInit('Voice assistant auto-start', ()=>{
  if(!state.voiceEnabled) return;
  document.getElementById('set-voice').checked = true;
  startVoiceAssistant()
    .then(ok=>{ state.voiceEnabled = !!ok; document.getElementById('set-voice').checked = !!ok; })
    .catch(()=>{ state.voiceEnabled = false; document.getElementById('set-voice').checked = false; });
});

// Belt-and-braces: whatever else happened above, if we're somehow still sitting on the
// splash screen a few seconds after load (a step above hung rather than threw, for example),
// force the transition to Home directly rather than waiting on the normal timed transition.
setTimeout(()=>{
  try{
    const splash = document.getElementById('screen-splash');
    if(splash && splash.classList.contains('active')) showScreen('home');
  }catch(e){
    try{
      const splash2 = document.getElementById('screen-splash');
      const home2 = document.getElementById('screen-home');
      if(splash2 && splash2.classList.contains('active') && home2){ splash2.classList.remove('active'); home2.classList.add('active'); }
    }catch(e2){ /* the top-of-file safety net is the final backstop beyond this */ }
  }
}, 3200);

if(startupErrors.length){
  setTimeout(()=>{
    try{ showToast('Some features didn\'t start correctly (' + startupErrors.join(', ') + ') — the rest of the app still works.', true); }
    catch(e){ /* toast itself failing is not worth doing anything further about */ }
  }, 3400);
}

/* ---- PWA: service worker (static app shell only; it never caches /api responses) ---- */
safeInit('Offline support (service worker)', ()=>{
  if(!('serviceWorker' in navigator) || !window.isSecureContext) return;
  window.addEventListener('load', ()=>{ navigator.serviceWorker.register('service-worker.js').catch(()=>{}); });
});

})();
