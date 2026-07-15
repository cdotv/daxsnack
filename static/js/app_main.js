(function () {
  const data = (function () {
    const node = document.getElementById('ds-data');
    if (!node) return {};
    try {
      const parsed = JSON.parse(node.textContent || '{}');
      return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (_) {
      return {};
    }
  })();
  const injectedSetup = (data.injectedSetup !== undefined) ? data.injectedSetup : null;
  const injectedDaySetups = (data.injectedDaySetups !== undefined) ? data.injectedDaySetups : null;
  const capitalCheck = (data.capitalCheck !== undefined) ? data.capitalCheck : null;
  const injectedRunning = (data.injectedRunning !== undefined) ? data.injectedRunning : null;
  const injectedClosed = (data.injectedClosed !== undefined) ? data.injectedClosed : null;
  const injectedPublicActivity = (data.injectedPublicActivity !== undefined) ? data.injectedPublicActivity : null;
  const injectedInstrumentStats = (data.injectedInstrumentStats !== undefined) ? data.injectedInstrumentStats : null;
  let injectedBenchmarkRanking = (data.injectedBenchmarkRanking !== undefined) ? data.injectedBenchmarkRanking : null;
  const benchmarkSnapshotUrl = (data.benchmarkSnapshotUrl !== undefined) ? data.benchmarkSnapshotUrl : null;
  const openTradesSnapshotUrl = (data.openTradesSnapshotUrl !== undefined) ? data.openTradesSnapshotUrl : null;
  const accountTotalDeltaPct = (data.accountTotalDeltaPct !== undefined) ? data.accountTotalDeltaPct : null;
  const siteOwner = (data.siteOwner && typeof data.siteOwner === 'object') ? data.siteOwner : {};
  const BENCHMARK_LABELS = {
    DAXSNACK: 'daxsnack',
  };
  let benchPollStarted = false;
  let openTradesPollStarted = false;
  let openTradesRenderPending = false;
  let runningPanelLoaded = false;
  let closedPanelLoaded = false;
  let tvScriptLoadStarted = false;
  let tvScriptLoaded = false;
  let tvScriptFailed = false;
  let topChartLoadRequested = false;
  let topChartAutoLoadScheduled = false;
  let topChartObserverStarted = false;
  const tvReadyQueue = [];
  const openTradesLastPx = {};
  const openTradesAllowed = (function () {
    const out = {};
    try {
      const items = (injectedRunning && Array.isArray(injectedRunning.items)) ? injectedRunning.items : [];
      items.forEach((it) => {
        if (!it || typeof it !== 'object') return;
        const inst = it.instrument || {};
        const ep = String(inst.epic || inst.symbol || '').toUpperCase();
        if (ep) out[ep] = true;
      });
    } catch (_) {}
    return out;
  })();

        // simple i18n dictionary (all lowercase)
        const i18n = {
          en: {
            setup_of_the_day: 'today’s setup',
            nav_setup: 'setup',
            nav_how: 'how it works',
            running_setups: 'open trades',
            closed_trades: 'closed trades',
            running_closed: 'closed',
            running_update_stop: 'update stop',
            running_update_stop_tip: 'new trailing stop suggested',
            running_open_tip: 'trade is currently open',
            running_exit_today_tip: 'exit criteria met on today\'s bar',
            running_exit_next: 'exit next trading day',
            running_exit_next_tip: 'exit criteria met; exit on next trading day due to weekend',
            running_exit_prefix: 'exit',
            pill_new: 'new',
            gslo_badge: 'GSLO',
            gslo_tip: 'Guaranteed stop: broker guarantees your stop price even through gaps.',
            capital_insufficient: "not enough capital to execute today's setup",
            label_reserved: 'reserved',
            label_needed: 'needed',
            label_of: 'of',
            intro_down_label: 'scroll down ↓',
            theme_toggle_label: 'toggle color theme',
            lang_toggle_label: 'switch language',
            nav_next: 'next',
            nav_previous: 'previous',
            last_check: 'updated',
            setup_found: 'setup ready',
            imp_link: 'Imprint',
            lic_link: 'Licenses',
            imp_title: 'Imprint',
            lic_title: 'Licenses',
            imp_close: 'close',
            imp_sending: 'Sending…',
            imp_sent: 'Message sent. Thank you!',
            imp_error: 'Sending failed.',
            imp_network: 'Network error.',
            imp_err_name: 'Please enter your name.',
            imp_err_email: 'Please enter a valid email.',
            imp_err_message: 'Please enter a message.',

            // Disclaimer
            disclaimer_label: 'risk disclaimer:',
            disclaimer_summary: 'trading involves risk. you can lose some or all of the capital used. historical results, backtests and simulations do not predict future performance.',
            disclaimer_details: ' no warranty is given for the accuracy or completeness of data, calculations, or model outputs. all content reflects the author\'s personal views, is provided for educational purposes only, and does not constitute financial advice, investment advice, or a solicitation to buy or sell financial instruments. no liability is assumed for losses or damages resulting from the use of this website or from acting on its content.',
            disclaimer_close: 'close',
            disclaimer_more: 'more',
            disclaimer_less: 'less',
            about_1: 'daxsnack runs the market universe and strategies configured by its operator.',
            about_1_html: '<strong>daxsnack</strong> runs the market universe and strategies configured by its operator.',
            about_2: 'the operator is responsible for independently validating every connected strategy.',
            about_3: 'the daily result is one setup with entry and stop, or no setup.',
            how_title: 'your universe. your strategy. your setup.',
            how_1: 'scan. daily prices are refreshed and every active strategy is run.',
            how_2: 'check. only connect strategies you have independently validated.',
            how_3: 'select. portfolio and account limits determine the setup published for the day.',
            stat_instruments: 'configured instruments',
            stat_strategies: 'operator strategies',
            stat_daily: 'candidate combinations',
            label_close: 'close',
            no_setup_found: 'no setup today',
            intro_right_title: 'start here',
            how_li1_html: 'read the <a href="#" id="start-guide-link" class="start-guide-link">guide</a>',
            how_li2: 'get the daily setup by email. free.',
            how_li3: 'view today’s setup ↓',
            start_guide_title: 'follow the setup',
            basics_title: 'read the setup',
            basics_1: 'direction shows long or short.',
            basics_2: 'entry is the trigger price. stop is the price that invalidates the setup.',
            basics_3: 'volume and follow-through support trade management after entry.',
            risk_title: 'risk limits',
            risk_1: 'define an initial-risk limit appropriate for your system.',
            risk_2: 'define how many positions may be open at the same time.',
            risk_3: 'define a portfolio exposure limit before enabling execution.',
            benchmark_title: 'performance comparison',
            benchmark_since: 'performance since configured start',
            activity_title: 'activity',
            activity_setup_published: 'setup published',
            activity_no_setup: 'no setup published',
            activity_trade_opened: 'trade opened',
            activity_trade_closed: 'trade closed',
            activity_override_applied: 'strategy update applied',
            activity_override_disabled: 'strategy update disabled',
            activity_universe_updated: 'market universe refreshed',
            activity_git_commit: 'latest git commit',
            activity_enabled_epics: 'epics enabled',
            activity_outcome_stopped: 'stopped out',
            activity_outcome_win: 'winner',
            activity_outcome_loss: 'loser',
            activity_outcome_closed: 'closed',
            metrics_heading: 'strategy metrics',
            metrics_overall: 'daxsnack',
            metrics_weight: 'weight',
            metrics_sharpe_ratio: 'sharpe ratio',
            metrics_volatility: 'volatility',
            metrics_win_rate: 'win rate',
            metrics_side_mix: 'side',
            metrics_best: 'best',
            metrics_worst: 'worst',
            metrics_avg_win: 'avg win',
            metrics_avg_loss: 'avg loss',
            basics_lbl_open: 'Open', basics_lbl_high: 'High', basics_lbl_low: 'Low', basics_lbl_close: 'Close',

            // Start Guide
            start_psych_1: 'check the direction, entry and stop before placing the order.',
            start_psych_2: 'review the published market and apply the risk limits you configured.',
            start_psych_3: 'follow the stop and exit updates shown with the open trade.',
            // Account setup
            account_title: 'execution',
            account_1: 'connect the market-data and execution provider you choose.',
            account_3: 'test the complete integration in a non-production environment first.',
            // Account bar
            acc_label: 'bal.',
            acc_since: 'performance since configured start',
            acc_est_ann: 'est. annual return',
            sub_placeholder: 'you@example.com',
            sub_btn: 'get daily setup',
            email_label: 'Email address',
            sub_ok: 'Check your inbox to confirm your email.',
            sub_err_email: 'Please enter a valid email.',
            sub_error: 'Subscription failed.',
            running_open: 'open',
            running_exit_today: 'exit today',
            running_main_chart_tip: 'show this instrument in top chart',
            running_stopped: 'stopped out',
            running_stopped_tip: 'stop was hit',
            label_pnl: 'profit',
            label_entry: 'entry',
            label_stop: 'stop',
            label_initial_stop: 'initial&nbsp;stop',
            label_trailing_stop: 'trailing&nbsp;stop',
            label_size: 'size',
            label_risk: 'risk',
            // FAQ
            faq_title: 'frequently asked questions',
            faq_q_price_action: 'how is a setup selected?',
            faq_a_price_action_html: `
              <p>
                this public application displays the output of your configured provider. strategy design, validation and portfolio rules remain your responsibility.
              </p>
            `,
            faq_q_second_entry: 'why is there no setup today?',
            faq_a_second_entry_html: `
              <p>
                your provider may return no candidate. in that case the daily result is “no setup today.”
              </p>
            `,
            faq_q_acceptance: 'how are strategies validated?',
            faq_a_acceptance_html: `
              <p>
                the public repository does not include a strategy or validation rules. create and validate your own before connecting it.
              </p>
            `,
            faq_q_execution: 'what do i execute?',
            faq_a_execution_html: `
              <p>
                choose your own execution provider, position sizing and protective controls. start with simulated execution.
              </p>
            `,
          },
          de: {
            setup_of_the_day: 'heutiges setup',
            nav_setup: 'setup',
            nav_how: 'so funktioniert es',
            running_setups: 'offene trades',
            closed_trades: 'geschlossene trades',
            running_closed: 'geschlossen',
            running_update_stop: 'Stopp anpassen',
            running_update_stop_tip: 'neuer Trailing‑Stopp vorgeschlagen',
            running_open_tip: 'Trade ist aktuell offen',
            running_exit_today_tip: 'Ausstiegskriterien heute erfüllt',
            pill_new: 'neu',
            gslo_badge: 'GSLO',
            gslo_tip: 'Garantierter Stopp: Der Broker garantiert Ihren Stoppreis auch bei Kurslücken.',
            capital_insufficient: 'nicht genug kapital, um das heutige setup auszuführen',
            label_reserved: 'reserviert',
            label_needed: 'benötigt',
            label_of: 'von',
            intro_down_label: 'scrolle nach unten ↓',
            theme_toggle_label: 'farbmodus wechseln',
            lang_toggle_label: 'sprache wechseln',
            nav_next: 'weiter',
            nav_previous: 'zurück',
            imp_link: 'Impressum',
            lic_link: 'Lizenzen',
            imp_title: 'Impressum',
            lic_title: 'Lizenzen',
            imp_close: 'schließen',
            imp_sending: 'Senden…',
            imp_sent: 'Nachricht gesendet. Danke!',
            imp_error: 'Senden fehlgeschlagen.',
            imp_network: 'Netzwerkfehler.',
            imp_err_name: 'Bitte Namen angeben.',
            imp_err_email: 'Ungültige E‑Mail-Adresse.',
            imp_err_message: 'Bitte eine Nachricht eingeben.',

            // Disclaimer
            disclaimer_label: 'risikohinweis:',
            disclaimer_summary: 'trading birgt risiken. du kannst einen teil oder das gesamte eingesetzte kapital verlieren. historische ergebnisse, backtests und simulationen erlauben keine verlässliche aussage über die zukünftige wertentwicklung.',
            disclaimer_details: ' für die richtigkeit und vollständigkeit von daten, berechnungen und modellresultaten wird keine garantie übernommen. sämtliche inhalte geben ausschließlich die persönlichen ansichten des autors wieder, dienen nur didaktischen und informativen zwecken und stellen weder finanzberatung noch anlageberatung noch eine aufforderung zum kauf oder verkauf von finanzinstrumenten dar. für verluste oder schäden, die aus der nutzung dieser website oder aus dem handeln auf basis ihrer inhalte entstehen, wird keine haftung übernommen.',
            disclaimer_close: 'schließen',
            disclaimer_more: 'mehr',
            disclaimer_less: 'weniger',
            about_1: 'daxsnack nutzt das marktuniversum und die strategien des betreibers.',
            about_1_html: '<strong>daxsnack</strong> nutzt das marktuniversum und die strategien des betreibers.',
            about_2: 'der betreiber muss jede angebundene strategie unabhängig validieren.',
            about_3: 'das tagesergebnis ist ein setup mit einstieg und stopp oder kein setup.',
            how_title: 'dein universum. deine strategie. dein setup.',
            how_1: 'scannen. tägliche kurse werden aktualisiert und jede aktive strategie wird ausgeführt.',
            how_2: 'prüfen. binde nur unabhängig validierte strategien an.',
            how_3: 'auswählen. portfolio- und kontogrenzen bestimmen das setup des tages.',
            stat_instruments: 'konfigurierte instrumente',
            stat_strategies: 'eigene strategien',
            stat_daily: 'kandidaten-kombinationen',
            label_close: 'schluss',
            no_setup_found: 'heute kein setup',
            intro_right_title: 'hier starten',
            how_li1_html: '<a href="#" id="start-guide-link" class="start-guide-link">anleitung lesen</a>',
            how_li2: 'erhalte das tägliche setup kostenlos per e-mail.',
            how_li3: 'heutiges setup ansehen ↓',
            start_guide_title: 'setup umsetzen',
            basics_title: 'setup lesen',
            basics_1: 'die richtung zeigt long oder short.',
            basics_2: 'der einstieg ist der triggerkurs. der stopp ist der kurs, der das setup ungültig macht.',
            basics_3: 'volumen und anschlussbewegung unterstützen das trade-management nach dem einstieg.',
            risk_title: 'risikogrenzen',
            risk_1: 'definiere ein angemessenes anfangsrisiko für dein system.',
            risk_2: 'definiere, wie viele positionen gleichzeitig offen sein dürfen.',
            risk_3: 'definiere vor der ausführung eine portfolio-obergrenze.',
            benchmark_title: 'performancevergleich',
            benchmark_since: 'performance seit konfiguriertem start',
            activity_title: 'aktivität',
            activity_setup_published: 'setup veröffentlicht',
            activity_no_setup: 'kein setup veröffentlicht',
            activity_trade_opened: 'trade eröffnet',
            activity_trade_closed: 'trade geschlossen',
            activity_override_applied: 'strategie-update aktiviert',
            activity_override_disabled: 'strategie-update deaktiviert',
            activity_universe_updated: 'marktuniversum aktualisiert',
            activity_git_commit: 'letzter git-commit',
            activity_enabled_epics: 'epics aktiviert',
            activity_outcome_stopped: 'ausgestoppt',
            activity_outcome_win: 'gewinner',
            activity_outcome_loss: 'verlierer',
            activity_outcome_closed: 'geschlossen',
            metrics_heading: 'strategie-kennzahlen',
            metrics_overall: 'daxsnack',
            metrics_weight: 'Gewicht',
            metrics_sharpe_ratio: 'Sharpe-Ratio',
            metrics_volatility: 'Volatilität',
            metrics_win_rate: 'Trefferquote',
            metrics_side_mix: 'Richtung',
            metrics_best: 'Best',
            metrics_worst: 'Schlechtest',
            metrics_avg_win: 'Ø Gewinn',
            metrics_avg_loss: 'Ø Verlust',

            // Start Guide
            start_psych_1: 'prüfe richtung, einstieg und stopp, bevor du die order platzierst.',
            start_psych_2: 'prüfe den veröffentlichten markt und nutze deine konfigurierten risikogrenzen.',
            start_psych_3: 'folge den stopp- und ausstiegshinweisen beim offenen trade.',
            // Konto einrichten
            account_title: 'ausführung',
            account_1: 'verbinde den markt- und ausführungsanbieter deiner wahl.',
            account_3: 'teste die vollständige integration zuerst ohne produktivaufträge.',
            // Kontozeile
            acc_label: 'Kto.-St.',
            acc_since: 'performance seit konfiguriertem start',
            acc_est_ann: 'gesch. Rendite pro Jahr',
            last_check: 'aktualisiert',
            setup_found: 'setup bereit',
            sub_placeholder: 'subscriber@example.com',
            sub_btn: 'setup erhalten',
            email_label: 'E‑Mail Adresse',
            sub_ok: 'Prüfe deinen Posteingang und bestätige deine E-Mail-Adresse.',
            sub_err_email: 'Bitte gültige E‑Mail-Adresse.',
            sub_error: 'Abonnement fehlgeschlagen.',
            running_open: 'offen',
            running_exit_today: 'Ausstieg heute',
            running_exit_next: 'Ausstieg am nächsten Handelstag',
            running_exit_next_tip: 'Ausstiegskriterien erfüllt; Ausstieg am nächsten Handelstag (Wochenende)',
            running_exit_prefix: 'Ausstieg',
            running_main_chart_tip: 'dieses Instrument im oberen Chart anzeigen',
            running_stopped: 'ausgestoppt',
            running_stopped_tip: 'stopp wurde ausgelöst',
            label_pnl: 'Profit',
            label_entry: 'einstieg',
            label_stop: 'stopp',
            label_initial_stop: 'Initial&nbsp;Stopp',
            label_trailing_stop: 'Trailing&nbsp;Stopp',
            label_size: 'größe',
            label_risk: 'risiko',
            basics_lbl_open: 'Eröffnung', basics_lbl_high: 'Hoch', basics_lbl_low: 'Tief', basics_lbl_close: 'Schluss',
            // FAQ
            faq_title: 'häufig gestellte fragen',
            faq_q_price_action: 'wie wird ein setup ausgewählt?',
            faq_a_price_action_html: `
              <p>
                diese öffentliche anwendung zeigt die ausgabe deines konfigurierten providers. strategie, validierung und portfolioregeln bleiben deine verantwortung.
              </p>
            `,
            faq_q_second_entry: 'warum gibt es heute kein setup?',
            faq_a_second_entry_html: `
              <p>
                dein provider kann keinen kandidaten liefern. dann lautet das tagesergebnis „heute kein setup“.
              </p>
            `,
            faq_q_acceptance: 'wie werden strategien geprüft?',
            faq_a_acceptance_html: `
              <p>
                das öffentliche repository enthält weder strategie noch validierungsregeln. entwickle und prüfe deine eigenen vor der anbindung.
              </p>
            `,
            faq_q_execution: 'was führe ich selbst aus?',
            faq_a_execution_html: `
              <p>
                wähle deinen ausführungsanbieter, die positionsgröße und schutzmaßnahmen selbst. beginne mit einer simulation.
              </p>
            `,
          }
        };

        let currentLang = 'en';

        function resolveLang() {
          try {
            const saved = localStorage.getItem('lang');
            if (saved === 'en' || saved === 'de') return saved;
          } catch (_) {}
          try {
            const ck = getCookie('lang');
            if (ck === 'en' || ck === 'de') return ck;
          } catch (_) {}
          const nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
          return nav.startsWith('de') ? 'de' : 'en';
        }

        function applyLang(lang) {
          currentLang = (lang === 'de' ? 'de' : 'en');
          const t = i18n[currentLang];
          try { document.documentElement.setAttribute('lang', currentLang); } catch (_) {}
          const el = (id) => document.getElementById(id);
          const set = (id, text) => { const n = el(id); if (n) n.textContent = text; };
          set('nav-setup', t.nav_setup);
          set('nav-how', t.nav_how);
          try { const rt = document.getElementById('running-title'); if (rt && t.running_setups) rt.textContent = t.running_setups; } catch (_) {}
          try { const ct = document.getElementById('closed-title'); if (ct && t.closed_trades) ct.textContent = t.closed_trades; } catch (_) {}
          try { const down = document.getElementById('intro-down'); if (down && t.intro_down_label) { down.setAttribute('aria-label', t.intro_down_label); down.setAttribute('title', t.intro_down_label); } } catch (_) {}
          try {
            const tt = document.getElementById('theme-toggle');
            if (tt && t.theme_toggle_label) {
              tt.setAttribute('aria-label', t.theme_toggle_label);
              tt.setAttribute('title', t.theme_toggle_label);
            }
          } catch (_) {}
          set('impressum-link', t.imp_link);
          set('licenses-link', t.lic_link);
          set('impressum-title', t.imp_title);
          set('licenses-title', t.lic_title);
          const impressumCloseBtn = document.querySelector('#impressum-modal .impressum-close');
          if (impressumCloseBtn) { impressumCloseBtn.setAttribute('aria-label', t.imp_close); impressumCloseBtn.setAttribute('title', t.imp_close); }
          const licensesCloseBtn = document.querySelector('#licenses-modal .impressum-close');
          if (licensesCloseBtn) { licensesCloseBtn.setAttribute('aria-label', t.imp_close); licensesCloseBtn.setAttribute('title', t.imp_close); }
          // Render Impressum body and (re)bind form handlers
          renderImpressum(currentLang);
          renderLicenses(currentLang);
          bindImpressumForm();
          try {
            const a1 = document.getElementById('about-1');
            if (a1) {
              if (t.about_1_html) { a1.innerHTML = t.about_1_html; }
              else if (t.about_1) { a1.textContent = t.about_1; }
            }
          } catch (_) {}
          set('about-2', t.about_2);
          set('about-3', t.about_3);
          set('how-title', t.how_title);
          set('how-1', t.how_1);
          set('how-2', t.how_2);
          set('how-3', t.how_3);
          set('stat-instruments-label', t.stat_instruments);
          set('stat-strategies-label', t.stat_strategies);
          set('stat-daily-label', t.stat_daily);
          set('stat-daily-num', '—');
          // OHLC legend labels
          try {
            const f = (id, txt) => { const el = document.getElementById(id); if (el && txt) el.textContent = txt; };
            f('ohlc-open-text', t.basics_lbl_open);
            f('ohlc-high-text', t.basics_lbl_high);
            f('ohlc-low-text', t.basics_lbl_low);
            f('ohlc-close-text', t.basics_lbl_close);
            f('ohlc-down-open-text', t.basics_lbl_open);
            f('ohlc-down-high-text', t.basics_lbl_high);
            f('ohlc-down-low-text', t.basics_lbl_low);
            f('ohlc-down-close-text', t.basics_lbl_close);
          } catch (_) {}
          // Intro how-to & start guide
          try { const n = document.getElementById('intro-right-title'); if (n && t.intro_right_title) n.textContent = t.intro_right_title; } catch (_) {}
          try { const li1 = document.getElementById('how-li-1'); if (li1 && t.how_li1_html) li1.innerHTML = t.how_li1_html; } catch (_) {}
          try { const n2 = document.getElementById('how-li-2'); if (n2 && t.how_li2) n2.innerHTML = t.how_li2; } catch (_) {}
          try { const n3 = document.getElementById('how-li-3'); if (n3 && t.how_li3) n3.innerHTML = t.how_li3; } catch (_) {}
          try { const sgT = document.getElementById('start-guide-title'); if (sgT && t.start_guide_title) sgT.textContent = t.start_guide_title; } catch (_) {}
          try { const bt = document.getElementById('basics-title'); if (bt && t.basics_title) bt.textContent = t.basics_title; } catch (_) {}
          try { const b1 = document.getElementById('basics-1'); if (b1 && t.basics_1) b1.textContent = t.basics_1; } catch (_) {}
          try { const b2 = document.getElementById('basics-2'); if (b2 && t.basics_2) b2.textContent = t.basics_2; } catch (_) {}
          try { const b3 = document.getElementById('basics-3'); if (b3 && t.basics_3) b3.textContent = t.basics_3; } catch (_) {}
          try { const rk = document.getElementById('risk-title'); if (rk && t.risk_title) rk.textContent = t.risk_title; } catch (_) {}
          try { const r1 = document.getElementById('risk-1'); if (r1 && t.risk_1) r1.textContent = t.risk_1; } catch (_) {}
          try { const r2 = document.getElementById('risk-2'); if (r2 && t.risk_2) r2.textContent = t.risk_2; } catch (_) {}
          try { const r3 = document.getElementById('risk-3'); if (r3 && t.risk_3) r3.textContent = t.risk_3; } catch (_) {}
          // Disclaimer text + labels
          try { const dl = document.getElementById('disclaimer-label'); if (dl && t.disclaimer_label) dl.textContent = t.disclaimer_label; } catch (_) {}
          try { const ds = document.getElementById('disclaimer-summary'); if (ds && t.disclaimer_summary) ds.textContent = t.disclaimer_summary; } catch (_) {}
          try { const dd = document.getElementById('disclaimer-details'); if (dd && t.disclaimer_details) dd.textContent = t.disclaimer_details; } catch (_) {}
          try {
            const dtg = document.getElementById('disclaimer-toggle');
            const bar = document.getElementById('disclaimer');
            if (dtg) {
              const expanded = !!(bar && bar.getAttribute('data-expanded') === 'true');
              const toggleLbl = expanded ? (t.disclaimer_less || 'less') : (t.disclaimer_more || 'more');
              dtg.textContent = toggleLbl;
              dtg.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            }
          } catch (_) {}
          try {
            const dc = document.getElementById('disclaimer-close');
            if (dc) {
              const lbl = (t.disclaimer_close || 'close');
              dc.textContent = lbl;
              dc.setAttribute('aria-label', lbl);
              dc.setAttribute('title', lbl);
            }
          } catch (_) {}
          // Slide 2: mindset
          try { const p1 = document.getElementById('start-psych-1'); if (p1 && t.start_psych_1) p1.textContent = t.start_psych_1; } catch (_) {}
          try { const p2 = document.getElementById('start-psych-2'); if (p2 && t.start_psych_2) p2.textContent = t.start_psych_2; } catch (_) {}
          try { const p3 = document.getElementById('start-psych-3'); if (p3 && t.start_psych_3) p3.textContent = t.start_psych_3; } catch (_) {}
          // Slide 3: account setup
          try { const at = document.getElementById('account-title'); if (at && t.account_title) at.textContent = t.account_title; } catch (_) {}
          try { const a1 = document.getElementById('account-1'); if (a1 && t.account_1) a1.textContent = t.account_1; } catch (_) {}
          try { const a3 = document.getElementById('account-3'); if (a3 && t.account_3) a3.textContent = t.account_3; } catch (_) {}
          // OHLC legend labels (again for deferred nodes)
          try {
            const f = (id, txt) => { const el = document.getElementById(id); if (el && txt) el.textContent = txt; };
            f('ohlc-open-text', t.basics_lbl_open);
            f('ohlc-high-text', t.basics_lbl_high);
            f('ohlc-low-text', t.basics_lbl_low);
            f('ohlc-close-text', t.basics_lbl_close);
            f('ohlc-down-open-text', t.basics_lbl_open);
            f('ohlc-down-high-text', t.basics_lbl_high);
            f('ohlc-down-low-text', t.basics_lbl_low);
            f('ohlc-down-close-text', t.basics_lbl_close);
          } catch (_) {}
          // Account bar (update all visible instances)
          try {
            const labels = document.querySelectorAll('.acc-label');
            labels.forEach(function(n){ if (n && t.acc_label) n.textContent = t.acc_label; });
          } catch (_) {}
          try {
            const annLabels = document.querySelectorAll('.acc-ann-label');
            annLabels.forEach(function(n){ if (n && t.acc_est_ann) n.textContent = t.acc_est_ann; });
          } catch (_) {}
          try {
            const sinceEls = document.querySelectorAll('#acc-since-right, #acc-since-only');
            sinceEls.forEach(function(n){ if (n && t.acc_since) n.textContent = t.acc_since; });
          } catch (_) {}
          // Localize currency formatting for account amounts (EUR)
          try {
            const langTag = (currentLang === 'de') ? 'de-DE' : 'en-US';
            const fmt = new Intl.NumberFormat(langTag, { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
            document.querySelectorAll('.acc-value[data-amount]').forEach(function(n){
              const raw = parseFloat(n.getAttribute('data-amount'));
              if (!Number.isNaN(raw)) { n.textContent = fmt.format(raw); }
            });
            document.querySelectorAll('.acc-delta-eur[data-amount]').forEach(function(n){
              const raw = parseFloat(n.getAttribute('data-amount'));
              if (!Number.isNaN(raw)) { n.textContent = fmt.format(raw); }
            });
          } catch (_) {}
          // FAQ text (if available in locale)
          try { const ft = document.getElementById('faq-title'); if (ft && t.faq_title) ft.textContent = t.faq_title; } catch (_) {}
          // FAQ items
          try { const fq1 = document.getElementById('faq-q1-label'); if (fq1 && t.faq_q_price_action) fq1.textContent = t.faq_q_price_action; } catch (_) {}
          try { const fa1 = document.getElementById('faq-a2e-1'); if (fa1 && t.faq_a_price_action_html) fa1.innerHTML = t.faq_a_price_action_html; } catch (_) {}
          try { const fq2 = document.getElementById('faq-q2-label'); if (fq2 && t.faq_q_second_entry) fq2.textContent = t.faq_q_second_entry; } catch (_) {}
          try { const fa2 = document.getElementById('faq-a2e-2'); if (fa2 && t.faq_a_second_entry_html) fa2.innerHTML = t.faq_a_second_entry_html; } catch (_) {}
          try { const fq3 = document.getElementById('faq-q3-label'); if (fq3 && t.faq_q_acceptance) fq3.textContent = t.faq_q_acceptance; } catch (_) {}
          try { const fa3 = document.getElementById('faq-a2e-3'); if (fa3 && t.faq_a_acceptance_html) fa3.innerHTML = t.faq_a_acceptance_html; } catch (_) {}
          try { const fq4 = document.getElementById('faq-q4-label'); if (fq4 && t.faq_q_execution) fq4.textContent = t.faq_q_execution; } catch (_) {}
          try { const fa4 = document.getElementById('faq-a2e-4'); if (fa4 && t.faq_a_execution_html) fa4.innerHTML = t.faq_a_execution_html; } catch (_) {}
          // Subscribe UI
          try { var sb = document.getElementById('sotd-subscribe'); if (sb && t.sub_btn) sb.textContent = t.sub_btn; } catch (_) {}
          try { var em = document.getElementById('sotd-email'); if (em && t.sub_placeholder) em.setAttribute('placeholder', t.sub_placeholder); } catch (_) {}
          try { var elab = document.querySelector('label[for="sotd-email"]'); if (elab && t.email_label) elab.textContent = t.email_label; } catch (_) {}
          try {
            var lbtn = document.getElementById('lang-toggle');
            if (lbtn) {
              lbtn.textContent = currentLang;
              lbtn.setAttribute('aria-label', t.lang_toggle_label || (currentLang === 'de' ? 'sprache wechseln' : 'switch language'));
              lbtn.setAttribute('title', t.lang_toggle_label || (currentLang === 'de' ? 'sprache wechseln' : 'switch language'));
            }
          } catch (_) {}
          try {
            document.querySelectorAll('.start-next').forEach(function(btn){
              const lbl = t.nav_next || 'next';
              btn.setAttribute('aria-label', lbl);
              btn.setAttribute('title', lbl);
            });
            document.querySelectorAll('.start-prev').forEach(function(btn){
              const lbl = t.nav_previous || 'previous';
              btn.setAttribute('aria-label', lbl);
              btn.setAttribute('title', lbl);
            });
            const guideNext = document.getElementById('guide-next');
            const guidePrev = document.getElementById('guide-prev');
            const guideNextText = document.getElementById('guide-next-text');
            const guidePrevText = document.getElementById('guide-prev-text');
            const nextLbl = t.nav_next || 'next';
            const prevLbl = t.nav_previous || 'previous';
            if (guideNext) {
              guideNext.setAttribute('aria-label', nextLbl);
              guideNext.setAttribute('title', nextLbl);
            }
            if (guidePrev) {
              guidePrev.setAttribute('aria-label', prevLbl);
              guidePrev.setAttribute('title', prevLbl);
            }
            if (guideNextText) guideNextText.textContent = nextLbl;
            if (guidePrevText) guidePrevText.textContent = prevLbl;
          } catch (_) {}
          try { if (typeof window._recalcIntroSliderHeight === 'function') window._recalcIntroSliderHeight(); } catch (_) {}
          try { if (typeof window._placeIntroArrow === 'function') window._placeIntroArrow(); } catch (_) {}
        }

        function resolveTheme() {
          const t = document.documentElement.dataset.theme;
          if (t === 'light' || t === 'dark') return t;
          return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
        }

        function getStoredThemePreference() {
          if (isMobile()) return null;
          try {
            const saved = localStorage.getItem('theme');
            if (saved === 'light' || saved === 'dark') return saved;
          } catch (_) {}
          try {
            const m = document.cookie.match('(?:^|; )theme=([^;]*)');
            const ck = m ? m[1] : null;
            if (ck === 'light' || ck === 'dark') return ck;
          } catch (_) {}
          return null;
        }

        function syncThemeToSystem() {
          if (getStoredThemePreference()) return;
          const systemTheme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
          document.documentElement.dataset.theme = systemTheme;
          setToggleIcon(systemTheme);
        }

        function isMobile() {
          try { return window.matchMedia && window.matchMedia('(max-width: 767px)').matches; } catch (_) { return false; }
        }

        const BULB_SVG = '<svg class="icon-bulb" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M18 9a6 6 0 10-12 0c0 2.485 1.5 3.5 2.25 4.5.48.64.75 1 .75 2.5h6c0-1.5.27-1.86.75-2.5.75-1 2.25-2.015 2.25-4.5z"/></svg>';

        // Operator details are supplied by the Django settings, never hard-coded here.
        const OWNER = {
          name: String(siteOwner.name || 'Site operator'),
          address: String(siteOwner.address || 'Configure SITE_OWNER_ADDRESS'),
          email: String(siteOwner.email || 'contact@example.com')
        };
        const FONT_LICENSE_URL = '/static/fonts/IBMPlexMono/LICENSE.txt';
        const TUX_SOURCE_URL = 'https://isc.tamu.edu/~lewing/linux/';
        const LINUX_MARK_URL = 'https://www.linuxfoundation.org/legal/the-linux-mark';
        const PYTHON_POLICY_URL = 'https://www.python.org/psf/trademarks/';
        const PYTHON_LOGO_URL = 'https://www.python.org/community/logos/';
        const HTML5_LOGO_URL = 'https://www.w3.org/html/logo/';
        const JS_LOGO_URL = 'https://github.com/voodootikigod/logo.js';
        const ORACLE_TRADEMARK_URL = 'https://www.oracle.com/legal/trademarks-rw/';
        const EU_ADR_INFO_URL_DE = 'https://commission.europa.eu/topics/consumers/consumer-rights-and-complaints/resolve-your-consumer-complaint/alternative-dispute-resolution-consumers_de';
        const EU_ADR_INFO_URL_EN = 'https://commission.europa.eu/topics/consumers/consumer-rights-and-complaints/resolve-your-consumer-complaint/alternative-dispute-resolution-consumers_en';

        // HTML blocks for Impressum per language
        const IMPRESSUM_HTML = {
          de: `
            <p><strong>Angaben gemäß § 5 TMG</strong></p>
            <p><strong>Name:</strong> ${OWNER.name}</p>
            <p><strong>Anschrift:</strong> ${OWNER.address.replace('Germany', 'Deutschland')}</p>
            <p><strong>Kontakt:</strong> E‑Mail: <a href="mailto:${OWNER.email}">${OWNER.email}</a></p>
            <p><strong>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV:</strong> ${OWNER.name}, Anschrift wie oben</p>
            <p><strong>Umsatzsteuer‑ID:</strong> keine USt‑IdNr.</p>
            <hr />
            <p><strong>Haftung für Inhalte</strong><br />
            Als Diensteanbieter bin ich gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG bin ich als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt.</p>
            <p><strong>Haftung für Links</strong><br />
            Dieses Angebot enthält ggf. Links zu externen Websites Dritter, auf deren Inhalte ich keinen Einfluss habe. Deshalb kann ich für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich.</p>
            <p><strong>Urheberrecht</strong><br />
            Die durch mich erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechts bedürfen meiner vorherigen schriftlichen Zustimmung. Soweit Inhalte auf dieser Seite nicht von mir erstellt wurden, werden die Urheberrechte Dritter beachtet und solche Inhalte als solche gekennzeichnet.</p>
            <p><strong>Verbraucherstreitbeilegung</strong><br />
            Informationen zur außergerichtlichen Beilegung von Verbraucherstreitigkeiten finden Sie auf der Website der Europäischen Kommission: <a href="${EU_ADR_INFO_URL_DE}" target="_blank" rel="noopener">Alternative Streitbeilegung für Verbraucher</a>.<br />
            Ich bin weder verpflichtet noch bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
            <hr />
            <h4>Kontaktformular</h4>
            <form id="impressum-contact-form" class="impressum-form">
              <div class="form-row">
                <label for="imp-name">Name</label>
                <input id="imp-name" name="name" type="text" required autocomplete="name" />
              </div>
              <div class="form-row">
                <label for="imp-email">E‑Mail</label>
                <input id="imp-email" name="email" type="email" required autocomplete="email" />
              </div>
              <div class="form-row">
                <label for="imp-message">Nachricht</label>
                <textarea id="imp-message" name="message" rows="5" required></textarea>
              </div>
              <div class="form-row" style="position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden;">
                <label for="imp-homepage">Homepage</label>
                <input id="imp-homepage" name="homepage" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" />
                <input id="imp-ts" name="ts" type="hidden" />
                <input id="imp-ttoken" name="ttoken" type="hidden" />
              </div>
              <div class="form-actions">
                <button id="imp-submit" type="submit">Senden</button>
                <span id="imp-status" class="form-status" aria-live="polite"></span>
              </div>
              <p class="form-disclaimer">Die abgesendeten Daten werden ausschließlich zur Bearbeitung Ihrer Anfrage verarbeitet. Weitere Informationen auf Anfrage.</p>
            </form>
          `,
          en: `
            <p><strong>Information pursuant to Section 5 TMG</strong></p>
            <p><strong>Name:</strong> ${OWNER.name}</p>
            <p><strong>Address:</strong> ${OWNER.address}</p>
            <p><strong>Contact:</strong> Email: <a href="mailto:${OWNER.email}">${OWNER.email}</a></p>
            <p><strong>Responsible under Section 18 (2) MStV:</strong> ${OWNER.name}, address as above</p>
            <p><strong>VAT ID:</strong> none</p>
            <hr />
            <p><strong>Liability for content</strong><br />
            As a service provider, I am responsible for my own content on these pages in accordance with general laws (Sec. 7(1) TMG). However, under Secs. 8–10 TMG, I am not obligated to monitor transmitted or stored third‑party information or to investigate circumstances indicating illegal activity. Obligations to remove or block the use of information under general laws remain unaffected.</p>
            <p><strong>Liability for links</strong><br />
            This site may contain links to external third‑party websites over whose content I have no control. Therefore, I cannot accept any liability for such external content. The respective provider or operator of the linked pages is always responsible for their content.</p>
            <p><strong>Copyright</strong><br />
            The content and works created by me on these pages are subject to German copyright law. Duplication, editing, distribution, and any kind of use outside the limits of copyright require my prior written consent. Where content on this site was not created by me, the copyrights of third parties are respected and such content is labeled accordingly.</p>
            <p><strong>Consumer dispute resolution</strong><br />
            Information on alternative dispute resolution for consumers is available on the European Commission website: <a href="${EU_ADR_INFO_URL_EN}" target="_blank" rel="noopener">Alternative dispute resolution for consumers</a>.<br />
            I am neither obligated nor willing to participate in dispute resolution proceedings before a consumer arbitration board.</p>
            <hr />
            <h4>Contact form</h4>
            <form id="impressum-contact-form" class="impressum-form">
              <div class="form-row">
                <label for="imp-name">Name</label>
                <input id="imp-name" name="name" type="text" required autocomplete="name" />
              </div>
              <div class="form-row">
                <label for="imp-email">Email</label>
                <input id="imp-email" name="email" type="email" required autocomplete="email" />
              </div>
              <div class="form-row">
                <label for="imp-message">Message</label>
                <textarea id="imp-message" name="message" rows="5" required></textarea>
              </div>
              <div class="form-row" style="position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden;">
                <label for="imp-homepage">Homepage</label>
                <input id="imp-homepage" name="homepage" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" />
                <input id="imp-ts" name="ts" type="hidden" />
                <input id="imp-ttoken" name="ttoken" type="hidden" />
              </div>
              <div class="form-actions">
                <button id="imp-submit" type="submit">Send</button>
                <span id="imp-status" class="form-status" aria-live="polite"></span>
              </div>
              <p class="form-disclaimer">Submitted data is processed solely to handle your request. More information available upon request.</p>
            </form>
          `
        };
        const LICENSES_HTML = {
          de: `
            <p><strong>Verwendete Marken und Lizenzhinweise</strong></p>
            <p>Im Footer werden nur offizielle oder original veröffentlichte Software-Logos angezeigt, deren Nutzungs- oder Lizenzbedingungen diese Darstellung zulassen.</p>
            <h4>IBM Plex Mono</h4>
            <p>Die Website-Schrift wird unter der SIL Open Font License 1.1 verwendet. <a href="${FONT_LICENSE_URL}" target="_blank" rel="noopener">Vollständigen Lizenztext öffnen</a>.</p>
            <h4>Tux / Linux</h4>
            <p>Das Tux-Bild stammt von Larry Ewing. Die Verwendung und Bearbeitung ist gestattet, sofern Larry Ewing und The GIMP genannt werden.</p>
            <p>Linux® ist die eingetragene Marke von Linus Torvalds in den USA und anderen Ländern.</p>
            <p><a href="${TUX_SOURCE_URL}" target="_blank" rel="noopener">Originale Tux-Quelle</a> · <a href="${LINUX_MARK_URL}" target="_blank" rel="noopener">Linux-Mark-Richtlinien</a></p>
            <h4>Python-Logo</h4>
            <p>Es wird das offizielle, unveränderte Python-Logo verwendet, um auf die Programmiersprache Python hinzuweisen.</p>
            <p>„Python“ und die Python-Logos sind Marken oder eingetragene Marken der Python Software Foundation und werden von daxsnack.com mit Genehmigung der Foundation verwendet.</p>
            <p><a href="${PYTHON_POLICY_URL}" target="_blank" rel="noopener">PSF Trademark Policy</a> · <a href="${PYTHON_LOGO_URL}" target="_blank" rel="noopener">Offizielle Logo-Assets</a></p>
            <h4>HTML5-Logo</h4>
            <p>Es wird das offizielle HTML5-Badge gemäß den W3C-HTML5-Logo-Bedingungen verwendet.</p>
            <p>Das HTML5-Logo steht unter Creative Commons Attribution 3.0.</p>
            <p><a href="${HTML5_LOGO_URL}" target="_blank" rel="noopener">Offizielle Nutzungsseite und Downloads</a></p>
            <h4>JavaScript-Logo</h4>
            <p>Es wird ein Community-Logo für JavaScript verwendet, das vom Projekt <em>logo.js</em> unter MIT-Lizenz veröffentlicht wurde. Es dient nur als referenzielle Kennzeichnung der Sprache JavaScript.</p>
            <p>Es wird kein offizielles Oracle-Logo verwendet. Die Nutzung erfolgt beschreibend im Sinne der allgemeinen Oracle-Markenrichtlinien.</p>
            <p><a href="${JS_LOGO_URL}" target="_blank" rel="noopener">logo.js-Projekt</a> · <a href="${ORACLE_TRADEMARK_URL}" target="_blank" rel="noopener">Oracle Trademark Guidelines</a></p>
          `,
          en: `
            <p><strong>Used marks and license notices</strong></p>
            <p>The footer displays only official or originally published software logos whose usage or license terms allow this presentation.</p>
            <h4>IBM Plex Mono</h4>
            <p>The website font is used under the SIL Open Font License 1.1. <a href="${FONT_LICENSE_URL}" target="_blank" rel="noopener">Open full license text</a>.</p>
            <h4>Tux / Linux</h4>
            <p>The Tux image is by Larry Ewing. Permission to use and modify it is granted provided Larry Ewing and The GIMP are acknowledged.</p>
            <p>Linux® is the registered trademark of Linus Torvalds in the U.S. and other countries.</p>
            <p><a href="${TUX_SOURCE_URL}" target="_blank" rel="noopener">Original Tux source</a> · <a href="${LINUX_MARK_URL}" target="_blank" rel="noopener">Linux mark guidelines</a></p>
            <h4>Python logo</h4>
            <p>The official unaltered Python logo is used to refer to the Python programming language.</p>
            <p>“Python” and the Python logos are trademarks or registered trademarks of the Python Software Foundation and are used by daxsnack.com with permission from the Foundation.</p>
            <p><a href="${PYTHON_POLICY_URL}" target="_blank" rel="noopener">PSF trademark policy</a> · <a href="${PYTHON_LOGO_URL}" target="_blank" rel="noopener">Official logo assets</a></p>
            <h4>HTML5 logo</h4>
            <p>The official HTML5 badge is used under the W3C HTML5 logo terms.</p>
            <p>The HTML5 logo is licensed under Creative Commons Attribution 3.0.</p>
            <p><a href="${HTML5_LOGO_URL}" target="_blank" rel="noopener">Official policy and downloads</a></p>
            <h4>JavaScript logo</h4>
            <p>A community JavaScript logo from the <em>logo.js</em> project is used under the MIT license. It is shown only to refer to the JavaScript language.</p>
            <p>No official Oracle logo is used. This referential use is intended to stay within Oracle’s general third-party trademark guidelines.</p>
            <p><a href="${JS_LOGO_URL}" target="_blank" rel="noopener">logo.js project</a> · <a href="${ORACLE_TRADEMARK_URL}" target="_blank" rel="noopener">Oracle trademark guidelines</a></p>
          `
        };

        function setToggleIcon(theme) {
          const btn = document.getElementById('theme-toggle');
          if (!btn) return;
          btn.innerHTML = BULB_SVG;
          btn.setAttribute('aria-label', theme === 'dark' ? 'switch to light theme' : 'switch to dark theme');
          btn.setAttribute('title', theme === 'dark' ? 'switch to light theme' : 'switch to dark theme');
        }

        function flushTVReadyQueue() {
          if (!window.TradingView) return;
          tvScriptLoaded = true;
          while (tvReadyQueue.length > 0) {
            const fn = tvReadyQueue.shift();
            try { if (typeof fn === 'function') fn(); } catch (_) {}
          }
        }

        function ensureTVPreconnects() {
          try {
            const head = document.head;
            if (!head) return;
            const origins = [
              'https://s3.tradingview.com',
              'https://www.tradingview-widget.com',
              'https://s.tradingview.com',
            ];
            origins.forEach(function (origin) {
              const sel = 'link[rel="preconnect"][href="' + origin + '"]';
              if (head.querySelector(sel)) return;
              const link = document.createElement('link');
              link.rel = 'preconnect';
              link.href = origin;
              link.crossOrigin = 'anonymous';
              head.appendChild(link);
            });
          } catch (_) {}
        }

        function startTVScriptLoad() {
          if (window.TradingView) { flushTVReadyQueue(); return; }
          if (tvScriptLoadStarted || tvScriptFailed) return;
          tvScriptLoadStarted = true;
          ensureTVPreconnects();
          const inject = function () {
            if (window.TradingView) { flushTVReadyQueue(); return; }
            try {
              const s = document.createElement('script');
              s.src = 'https://s3.tradingview.com/tv.js';
              s.async = true;
              s.onload = function () { flushTVReadyQueue(); };
              s.onerror = function () {
                tvScriptFailed = true;
                tvReadyQueue.length = 0;
                console.warn('TradingView script failed to load');
              };
              document.head.appendChild(s);
            } catch (_) {
              tvScriptFailed = true;
              tvReadyQueue.length = 0;
            }
          };
          if (document.readyState === 'complete') {
            if (window.requestIdleCallback) {
              try { window.requestIdleCallback(inject, { timeout: 2000 }); return; } catch (_) {}
            }
            setTimeout(inject, 0);
            return;
          }
          window.addEventListener('load', function () {
            if (window.requestIdleCallback) {
              try { window.requestIdleCallback(inject, { timeout: 2000 }); return; } catch (_) {}
            }
            setTimeout(inject, 0);
          }, { once: true });
        }

        function createTVWidget(symbol) {
          const theme = resolveTheme();
          if (!window.TradingView) return;
          const cid = 'tradingview_chart';
          const wrap = document.getElementById(cid);
          if (!wrap) return;
          try { wrap.innerHTML = ''; } catch (_) {}
          try {
            const widget = new TradingView.widget({
              symbol: symbol,
              interval: 'D',
              theme: theme,
              style: '1',
              timezone: 'Etc/UTC',
              container_id: cid,
              width: '100%',
              height: 600,
              hide_top_toolbar: false,
              hide_legend: false,
              withdateranges: true,
              allow_symbol_change: true,
              disabled_features: [
                "use_localstorage_for_settings",
              ],
              overrides: buildTradingViewSeriesOverrides({
                "paneProperties.legendProperties.showLegend": true,
                "paneProperties.legendProperties.showSeriesTitle": true,
                "paneProperties.legendProperties.showStudyTitles": true,
                "paneProperties.legendProperties.showStudyValues": true,
                "paneProperties.legendProperties.showStudyArguments": true,
                "paneProperties.legendProperties.showVolume": true,
              }),
              studies_overrides: buildTradingViewStudyOverrides(),
            });
            try { window._dax_top_tv_widget = widget; } catch (_) {}
          } catch (e) {
            console.warn('TradingView init failed', e);
          }
        }

        function requestTopChartLoad() {
          if (topChartLoadRequested) return;
          topChartLoadRequested = true;
          const topSymbol = toCapitalTvSymbol(window._dax_tv_symbol || null) || 'CAPITALCOM:US500';
          tvReady(function () { createTVWidget(topSymbol); });
        }

        function initTopChartLazyLoad() {
          if (topChartObserverStarted) return;
          topChartObserverStarted = true;
          const chartEl = document.getElementById('tradingview_chart');
          if (!chartEl) return;

          const onDemand = function () { requestTopChartLoad(); };
          try {
            chartEl.addEventListener('pointerdown', onDemand, { once: true, passive: true });
            chartEl.addEventListener('touchstart', onDemand, { once: true, passive: true });
          } catch (_) {}

          if ('IntersectionObserver' in window) {
            try {
              const io = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                  if (!entry || !entry.isIntersecting) return;
                  requestTopChartLoad();
                  try { io.disconnect(); } catch (_) {}
                });
              }, { root: null, rootMargin: '220px 0px', threshold: 0.01 });
              io.observe(chartEl);
              return;
            } catch (_) {}
          }

          const onScroll = function () {
            try {
              const rect = chartEl.getBoundingClientRect();
              const vh = window.innerHeight || document.documentElement.clientHeight || 0;
              if (rect.top <= (vh + 220) && rect.bottom >= -220) {
                requestTopChartLoad();
                window.removeEventListener('scroll', onScroll);
              }
            } catch (_) {}
          };
          window.addEventListener('scroll', onScroll, { passive: true });
          onScroll();
        }

        function scheduleTopChartAutoLoad() {
          if (topChartAutoLoadScheduled || topChartLoadRequested) return;
          topChartAutoLoadScheduled = true;
          onStartOverlayDone(function () {
            const trigger = function () {
              if (topChartLoadRequested) return;
              requestTopChartLoad();
            };
            const start = function () {
              if (window.requestIdleCallback) {
                try { window.requestIdleCallback(trigger, { timeout: 1200 }); return; } catch (_) {}
              }
              setTimeout(trigger, 0);
            };
            if (window.requestAnimationFrame) {
              window.requestAnimationFrame(function () {
                window.requestAnimationFrame(function () {
                  setTimeout(start, 350);
                });
              });
              return;
            }
            setTimeout(start, 350);
          });
        }

        function setTopTVSymbol(symbol, opts) {
          const topSymbol = toCapitalTvSymbol(symbol);
          if (!topSymbol) return;
          window._dax_tv_symbol = topSymbol;
          const forceLoad = !!(opts && opts.forceLoad);
          if (forceLoad) topChartLoadRequested = true;
          try {
            const w = window._dax_top_tv_widget;
            if (w && typeof w.setSymbol === 'function') {
              w.setSymbol(topSymbol, 'D', function () {});
              return;
            }
          } catch (_) {}
          if (!forceLoad && !topChartLoadRequested) return;
          tvReady(function () { createTVWidget(topSymbol); });
        }

        function toCapitalTvSymbol(epicOrSymbol) {
          if (epicOrSymbol === null || epicOrSymbol === undefined) return null;
          const raw = String(epicOrSymbol).trim();
          if (!raw) return null;
          if (raw.indexOf(':') > -1) return raw;
          return 'CAPITALCOM:' + raw.toUpperCase();
        }

        function readThemeCssVar(name, fallback) {
          try {
            const root = document.documentElement;
            if (!root || !window.getComputedStyle) return fallback;
            const value = window.getComputedStyle(root).getPropertyValue(name);
            return value && value.trim() ? value.trim() : fallback;
          } catch (_) {
            return fallback;
          }
        }

        function buildTradingViewSeriesOverrides(legendOverrides) {
          const moneyGreen = readThemeCssVar('--money-green', '#85bb65');
          const moneyGreenSoft = readThemeCssVar('--money-green-soft', '#a8d18a');
          const moneyGreenDeep = readThemeCssVar('--money-green-deep', '#6f9b55');
          const moneyRed = readThemeCssVar('--money-red', '#d86b6b');
          const moneyRedSoft = readThemeCssVar('--money-red-soft', '#ee9696');
          const moneyRedDeep = readThemeCssVar('--money-red-deep', '#bc5656');
          return Object.assign({
            "mainSeriesProperties.candleStyle.upColor": moneyGreen,
            "mainSeriesProperties.candleStyle.downColor": moneyRed,
            "mainSeriesProperties.candleStyle.borderUpColor": moneyGreenDeep,
            "mainSeriesProperties.candleStyle.borderDownColor": moneyRedDeep,
            "mainSeriesProperties.candleStyle.wickUpColor": moneyGreenSoft,
            "mainSeriesProperties.candleStyle.wickDownColor": moneyRedSoft,
            "mainSeriesProperties.barStyle.upColor": moneyGreen,
            "mainSeriesProperties.barStyle.downColor": moneyRed,
            "mainSeriesProperties.hollowCandleStyle.upColor": moneyGreen,
            "mainSeriesProperties.hollowCandleStyle.downColor": moneyRed,
            "mainSeriesProperties.hollowCandleStyle.borderUpColor": moneyGreenDeep,
            "mainSeriesProperties.hollowCandleStyle.borderDownColor": moneyRedDeep,
            "mainSeriesProperties.hollowCandleStyle.wickUpColor": moneyGreenSoft,
            "mainSeriesProperties.hollowCandleStyle.wickDownColor": moneyRedSoft,
          }, legendOverrides || {});
        }

        function buildTradingViewStudyOverrides() {
          const volumeUp = readThemeCssVar('--tv-volume-up', '#6b7280');
          const volumeDown = readThemeCssVar('--tv-volume-down', '#b5bcc6');
          return {
            "volume.volume.color.1": volumeUp,
            "volume.volume.color.0": volumeDown,
          };
        }

        function createInlineRunningTVWidget(containerId, epicOrSymbol) {
          const theme = resolveTheme();
          if (!window.TradingView || !containerId) return;
          const tvSymbol = toCapitalTvSymbol(epicOrSymbol);
          if (!tvSymbol) return;
          const wrap = document.getElementById(containerId);
          if (!wrap) return;
          try { wrap.innerHTML = ''; } catch (_) {}
          try {
            new TradingView.widget({
              symbol: tvSymbol,
              interval: 'D',
              theme: theme,
              style: '1',
              timezone: 'Etc/UTC',
              container_id: containerId,
              width: '100%',
              height: 280,
              hide_top_toolbar: true,
              withdateranges: false,
              allow_symbol_change: false,
              disabled_features: [
                "use_localstorage_for_settings",
              ],
              overrides: buildTradingViewSeriesOverrides({
                "paneProperties.legendProperties.showLegend": true,
                "paneProperties.legendProperties.showSeriesTitle": true,
                "paneProperties.legendProperties.showStudyTitles": false,
                "paneProperties.legendProperties.showStudyValues": false,
                "paneProperties.legendProperties.showStudyArguments": false,
                "paneProperties.legendProperties.showVolume": false,
              }),
              studies_overrides: buildTradingViewStudyOverrides(),
            });
          } catch (e) {
            console.warn('Inline running TradingView init failed', e);
          }
        }

        // Ensure TradingView script is loaded asynchronously after full page load.
        function tvReady(fn) {
          if (typeof fn !== 'function') return;
          if (window.TradingView) {
            try { fn(); } catch (_) {}
            return;
          }
          if (tvScriptFailed) return;
          tvReadyQueue.push(fn);
          startTVScriptLoad();
        }

        function fmtNum(x, digits = 2) {
          if (x === null || x === undefined || isNaN(x)) return '—';
          return Number(x).toFixed(digits);
        }

        function renderSetupMetrics(mainBest, agg, opts) {
          const host = document.getElementById('setup-metrics');
          if (!host) return;
          const dict = (i18n && i18n[currentLang]) || i18n.en || {};
          const stats = injectedInstrumentStats || {};
          const buckets = (stats && stats.instruments) || {};
          const overall = stats && stats.all;
          const overallTrades = (overall && typeof overall.trades === 'number' && isFinite(overall.trades) && overall.trades > 0)
            ? overall.trades
            : null;
          const todayStr = (new Date()).toISOString().slice(0, 10);
          const hasTodaySetup = !!(opts && opts.hasAnyTodaySetup);
          const hasSetupDisplayed = !!(opts && (opts.hasAnySetupDisplayed || opts.hasAnyTodaySetup));
          const isNextDayTouch = !!(window._dax_last_data && window._dax_last_data.next_day_touch);
          const aggItems = (agg && Array.isArray(agg.items)) ? agg.items : [];

          function bucketFor(item) {
            if (!item || !item.instrument) return null;
            const ep = (item.instrument.epic || item.instrument.symbol || '').toString().toUpperCase();
            if (ep && buckets[ep]) return buckets[ep];
            return null;
          }

          function sideMix(bucket) {
            if (!bucket) return { longPct: null, shortPct: null };
            const long = ((bucket.by_side || {}).long || {}).trades || 0;
            const short = ((bucket.by_side || {}).short || {}).trades || 0;
            const total = long + short;
            if (total <= 0) return { longPct: null, shortPct: null };
            return { longPct: (long / total) * 100, shortPct: (short / total) * 100 };
          }

          // Gather setups to show stats for
          const targets = [];
          const todayOnly = (!isNextDayTouch) && hasTodaySetup;
          const addTarget = (it) => {
            if (!it || !it.instrument) return;
            if (todayOnly) {
              try {
                const d = (it.date || it.generated_at_utc || '').toString().slice(0, 10);
                if (d && d !== todayStr) return;
              } catch (_) {}
            }
            const key = (it.instrument.epic || it.instrument.symbol || '').toString().toUpperCase();
            if (!key) return;
            if (targets.find((t) => t.key === key)) return;
            targets.push({ key, item: it });
          };
          // If there is no actionable setup today, show only overall stats and skip stale instruments.
          const useTargets = isNextDayTouch ? (aggItems.length > 0) : hasSetupDisplayed;
          if (useTargets) {
            if (!isNextDayTouch) addTarget(mainBest);
            try { aggItems.forEach(addTarget); } catch (_) {}
          }

          const deriveRet = (b) => {
            const out = { best: b.ret_best, worst: b.ret_worst, avgWin: b.ret_avg_win, avgLoss: b.ret_avg_loss };
            if ((out.best == null || out.worst == null || out.avgWin == null || out.avgLoss == null) && Array.isArray(b.returns)) {
              const rets = b.returns.filter((x) => typeof x === 'number' && isFinite(x));
              if (rets.length) {
                if (out.best == null) out.best = Math.max.apply(null, rets);
                if (out.worst == null) out.worst = Math.min.apply(null, rets);
                const wins = rets.filter((r) => r > 0);
                const losses = rets.filter((r) => r < 0);
                if (out.avgWin == null && wins.length) out.avgWin = wins.reduce((a, b) => a + b, 0) / wins.length;
                if (out.avgLoss == null && losses.length) out.avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length;
              }
            }
            return out;
          };
          const deriveVolatility = (b) => {
            if (!b || typeof b !== 'object') return null;
            if (b.volatility_ann != null && isFinite(b.volatility_ann)) return Math.abs(b.volatility_ann);
            if (b.volatility != null && isFinite(b.volatility)) return Math.abs(b.volatility);
            if (!Array.isArray(b.returns)) return null;
            const rets = b.returns.filter((x) => typeof x === 'number' && isFinite(x));
            if (rets.length <= 1) return null;
            let mean = 0;
            for (let i = 0; i < rets.length; i += 1) mean += rets[i];
            mean /= rets.length;
            let varSum = 0;
            for (let i = 0; i < rets.length; i += 1) {
              const d = rets[i] - mean;
              varSum += (d * d);
            }
            const sd = Math.sqrt(varSum / (rets.length - 1)); // return units are percent
            if (!(sd >= 0) || !isFinite(sd)) return null;
            let periodsPerYear = 252;
            if (Array.isArray(b.return_dates) && b.return_dates.length >= 2) {
              const parsed = b.return_dates
                .map((x) => new Date(String(x)))
                .filter((d) => !isNaN(d.getTime()))
                .sort((a, b2) => a.getTime() - b2.getTime());
              if (parsed.length >= 2) {
                const days = (parsed[parsed.length - 1].getTime() - parsed[0].getTime()) / (1000 * 60 * 60 * 24);
                const years = days / 365.25;
                if (years > 0) periodsPerYear = rets.length / years;
              }
            }
            const annVol = sd * Math.sqrt(Math.max(1, periodsPerYear));
            return isFinite(annVol) ? Math.abs(annVol) : null;
          };

          let cards = [];
          let isOverallOnly = false;
          if (targets.length === 0 && overall) {
            const mix = sideMix(overall);
            const r = deriveRet(overall);
            cards.push({
              title: '',
              win: overall.win_rate != null ? (overall.win_rate * 100) : null,
              sharpe: overall.sharpe != null ? overall.sharpe : null,
              volatility: deriveVolatility(overall),
              retBest: r.best,
              retWorst: r.worst,
              retAvgWin: r.avgWin,
              retAvgLoss: r.avgLoss,
              mix,
              trades: (overall && typeof overall.trades === 'number' && isFinite(overall.trades)) ? overall.trades : null,
            });
            isOverallOnly = true;
          } else {
            targets.forEach((t) => {
              const b = bucketFor(t.item);
              if (!b) return;
              const r = deriveRet(b);
              cards.push({
                title: t.item.instrument.name || t.item.instrument.symbol || t.key,
                win: b.win_rate != null ? (b.win_rate * 100) : null,
                sharpe: b.sharpe != null ? b.sharpe : null,
                volatility: deriveVolatility(b),
                retBest: r.best,
                retWorst: r.worst,
                retAvgWin: r.avgWin,
                retAvgLoss: r.avgLoss,
                mix: sideMix(b),
                trades: (b && typeof b.trades === 'number' && isFinite(b.trades)) ? b.trades : null,
              });
            });
          }

          if (!cards.length && overall) {
            const mix = sideMix(overall);
            const r = deriveRet(overall);
            cards.push({
              title: '',
              win: overall.win_rate != null ? (overall.win_rate * 100) : null,
              sharpe: overall.sharpe != null ? overall.sharpe : null,
              volatility: deriveVolatility(overall),
              retBest: r.best,
              retWorst: r.worst,
              retAvgWin: r.avgWin,
              retAvgLoss: r.avgLoss,
              mix,
              trades: (overall && typeof overall.trades === 'number' && isFinite(overall.trades)) ? overall.trades : null,
            });
            isOverallOnly = true;
          }

          if (!cards.length) {
            host.style.display = 'none';
            host.innerHTML = '';
            return;
          }

          let heading = dict.metrics_heading || 'metrics';
          let subheading = '';
          let hideCardTitles = false;
          const hasMultipleCards = cards.length > 1;
          try {
            const names = [];
            cards.forEach((c) => {
              const t = (c && c.title ? String(c.title) : '').trim();
              if (!t) return;
              if (!names.includes(t)) names.push(t);
            });
            // Single-setup case: show the instrument name once as a subheading
            // under the main "metrics" title, and hide the per-card title.
            if (!hasMultipleCards && names.length === 1) {
              subheading = names[0];
              hideCardTitles = true;
            }
          } catch (_) {
            subheading = '';
          }
          if (!subheading && isOverallOnly) {
            subheading = dict.metrics_overall || 'daxsnack';
          }
          // For multiple setups of the day, avoid a single subheading that
          // concatenates all instruments. Instead, each setup will get its own
          // subheading-style label next to its metrics block.
          if (hasMultipleCards) {
            hideCardTitles = true;
          }
          let html = '<h2 class="setup-metrics-title">' + escapeHtml(heading) + '</h2>';
          if (!hasMultipleCards && subheading) {
            html += '<div class="benchmark-since">' + escapeHtml(subheading) + '</div>';
          }

          host.innerHTML = html + cards.map((c) => {
            const winOk = (c.win != null && isFinite(c.win));
            const winPct = winOk ? Math.max(0, Math.min(100, c.win)) : null;
            const winTxt = winOk ? winPct.toFixed(1) + '%' : '—';
            const lp = c.mix.longPct;
            const sp = c.mix.shortPct;
            const hasMix = lp != null && sp != null && isFinite(lp) && isFinite(sp);
            const longPct = hasMix ? Math.max(0, Math.min(100, lp)) : null;
            const shortPct = hasMix ? Math.max(0, Math.min(100, sp)) : null;
            const mixBadgeTxt = hasMix
              ? 'long ' + longPct.toFixed(0) + '%\nshort ' + shortPct.toFixed(0) + '%'
              : '—';
            const volOk = (c.volatility != null && isFinite(c.volatility));
            const volVal = volOk ? Math.max(0, c.volatility) : null;
            const volTxt = volOk ? volVal.toFixed(2) + '%' : '—';
            const volWidth = volOk ? Math.max(3, Math.min(100, volVal)) : 0;
            const shOk = (c.sharpe != null && isFinite(c.sharpe));
            const shAbs = shOk ? Math.min(3, Math.abs(c.sharpe)) : null;
            const shWidth = shOk ? (shAbs > 0 ? Math.max(3, (shAbs / 3) * 100) : 0) : 0;
            const shCls = shOk ? (c.sharpe < 0 ? 'neg' : 'pos') : '';
            const shTxt = shOk ? c.sharpe.toFixed(2) : '—';
            const wtOk = (
              overallTrades != null &&
              c.trades != null &&
              isFinite(c.trades) &&
              c.trades >= 0
            );
            const wtPct = wtOk ? Math.max(0, Math.min(100, (c.trades / overallTrades) * 100)) : null;
            const wtFillPct = wtOk ? Math.max(0, Math.min(100, (wtPct / 10) * 100)) : null;
            const wtTxt = wtOk ? wtPct.toFixed(1) + '%' : '—';
            const wtLabel = escapeHtml(dict.metrics_weight || 'weight');
            const shLabel = escapeHtml(dict.metrics_sharpe_ratio || 'sharpe ratio');
            const volLabel = escapeHtml(dict.metrics_volatility || 'volatility');
            const winLabel = escapeHtml(dict.metrics_win_rate || 'win rate');
            const sideMixLabel = escapeHtml(dict.metrics_side_mix || 'side');
            const bestLabel = escapeHtml(dict.metrics_best || 'best');
            const worstLabel = escapeHtml(dict.metrics_worst || 'worst');
            const avgWinLabel = escapeHtml(dict.metrics_avg_win || 'avg win');
            const avgLossLabel = escapeHtml(dict.metrics_avg_loss || 'avg loss');
            const fmtPct = (v) => (v != null && isFinite(v)) ? v.toFixed(1) + '%' : '—';

            const makePairBars = (a, b, labelA, labelB) => {
              const va = (a != null && isFinite(a)) ? a : null;
              const vb = (b != null && isFinite(b)) ? b : null;
              if (va == null && vb == null) {
                return (
                  '<div class="metric-line chart-line">' +
                    '<span class="metric-label">' + labelA + ' / ' + labelB + '</span>' +
                    '<div class="metric-bar"><div class="metric-bar-fill" style="width:0%;"></div></div>' +
                    '<span class="metric-badge">—</span>' +
                  '</div>'
                );
              }
              let maxAbs = 0;
              [va, vb].forEach((v) => {
                if (v != null) {
                  const a = Math.abs(v);
                  if (a > maxAbs) maxAbs = a;
                }
              });
              if (!(maxAbs > 0)) maxAbs = 1;
              const row = (v, lab) => {
                if (v == null) {
                  return (
                    '<div class="metric-line chart-line pair-row">' +
                      '<span class="metric-label">' + lab + '</span>' +
                      '<div class="metric-bar"><div class="metric-bar-fill" style="width:0%;"></div></div>' +
                      '<span class="metric-badge">—</span>' +
                    '</div>'
                  );
                }
                const width = Math.max(3, Math.min(100, (Math.abs(v) / maxAbs) * 100));
                const txt = v.toFixed(1) + '%';
                const cls = v >= 0 ? 'pos' : 'neg';
                return (
                  '<div class="metric-line chart-line pair-row">' +
                    '<span class="metric-label">' + lab + '</span>' +
                    '<div class="metric-bar metric-bar-' + cls + '" title="' + txt + '">' +
                      '<div class="metric-bar-fill" style="width:' + width + '%;"></div>' +
                    '</div>' +
                    '<span class="metric-badge">' + txt + '</span>' +
                  '</div>'
                );
              };
              return row(va, labelA) + row(vb, labelB);
            };

            const winBar = winOk
              ? '<div class="metric-bar" title="' + winTxt + '"><div class="metric-bar-fill" style="width:' + winPct + '%;"></div></div><span class="metric-badge">' + winTxt + '</span>'
              : '<div class="metric-bar"><div class="metric-bar-fill" style="width:0%;"></div></div><span class="metric-badge">—</span>';
            const wtBar = wtOk
              ? '<div class="metric-bar" title="' + wtTxt + '"><div class="metric-bar-fill" style="width:' + wtFillPct + '%;"></div></div><span class="metric-badge">' + wtTxt + '</span>'
              : '<div class="metric-bar"><div class="metric-bar-fill" style="width:0%;"></div></div><span class="metric-badge">—</span>';
            const volBar = volOk
              ? '<div class="metric-bar" title="' + volTxt + '"><div class="metric-bar-fill" style="width:' + volWidth + '%;"></div></div><span class="metric-badge">' + volTxt + '</span>'
              : '<div class="metric-bar"><div class="metric-bar-fill" style="width:0%;"></div></div><span class="metric-badge">—</span>';

            const mixPie = hasMix
              ? (
                '<div class="metric-bar" title="' + mixBadgeTxt + '">' +
                  '<div class="metric-bar-stack ring-bar">' +
                    '<div class="metric-bar-seg long" style="width:' + longPct + '%;"></div>' +
                    '<div class="metric-bar-seg short" style="width:' + shortPct + '%;"></div>' +
                  '</div>' +
                '</div><span class="metric-badge metric-badge-side-mix">' + mixBadgeTxt + '</span>'
              )
              : '<div class="metric-bar"><div class="metric-bar-fill" style="width:0%;"></div></div><span class="metric-badge">—</span>';

            const showTitle = !!(c.title && !hideCardTitles);
            const safeTitle = escapeHtml(c.title || '');
            return (
              (hasMultipleCards && c.title ? '<div class="benchmark-since">' + safeTitle + '</div>' : '') +
                '<div class="metric-card">' +
                  (showTitle ? '<span class="metric-title">' + safeTitle + '</span>' : '') +
                '<div class="metric-line chart-line"><span class="metric-label">' + wtLabel + '</span>' + wtBar + '</div>' +
                '<div class="metric-line chart-line"><span class="metric-label">' + winLabel + '</span>' + winBar + '</div>' +
                '<div class="metric-line chart-line"><span class="metric-label">' + sideMixLabel + '</span>' + mixPie + '</div>' +
                makePairBars(c.retBest, c.retWorst, bestLabel, worstLabel) +
                makePairBars(c.retAvgWin, c.retAvgLoss, avgWinLabel, avgLossLabel) +
                (volOk ? ('<div class="metric-line chart-line"><span class="metric-label">' + volLabel + '</span>' + volBar + '</div>') : '') +
                (shOk ? ('<div class="metric-line chart-line"><span class="metric-label">' + shLabel + '</span><div class="metric-bar metric-bar-' + shCls + '" title="' + shTxt + '"><div class="metric-bar-fill" style="width:' + shWidth + '%;"></div></div><span class="metric-badge">' + shTxt + '</span></div>') : '') +
              '</div>'
            );
          }).join('');
          host.style.display = '';
        }

        function renderBenchmarkComparison() {
          const host = document.getElementById('benchmark-metrics');
          if (!host) return;
          const dict = (i18n && i18n[currentLang]) || i18n.en || {};
          const lockBenchmarkLabelWrap = (label) => {
            if (!label) return label;
            const str = String(label).replace(/&nbsp;/g, '\u00A0');
            const firstSpace = str.indexOf(' ');
            if (firstSpace === -1) return escapeHtml(str);
            const head = str.slice(0, firstSpace + 1);
            const tail = str.slice(firstSpace + 1).replace(/ /g, '\u00A0');
            return escapeHtml(head + tail);
          };
          const benchmarkLabelMap = {
            de: {
              'silver': 'silber',
              'germany (dax)': 'deutschland (dax)',
              'switzerland (smi)': 'Schweiz (SMI)',
              'australia (asx 200)': 'Australien (ASX 200)',
              'brazil (msci brazil)': 'Brazilien (MSCI Brazil)',
              'europe (stoxx&nbsp;50)': 'europa (stoxx&nbsp;50)',
              'world (msci&nbsp;acwi)': 'welt (msci&nbsp;acwi)',
            },
          };
          const items = Array.isArray(injectedBenchmarkRanking) ? injectedBenchmarkRanking.slice() : [];
          if (!items.length) {
            host.style.display = 'none';
            host.innerHTML = '';
            return;
          }
          let maxAbs = 0;
          items.forEach((it) => {
            const v = (it && typeof it.pct === 'number') ? it.pct : null;
            if (v != null && isFinite(v)) {
              const a = Math.abs(v);
              if (a > maxAbs) maxAbs = a;
            }
          });
          if (!(maxAbs > 0)) {
            host.style.display = 'none';
            host.innerHTML = '';
            return;
          }
          const rows = items.map((it) => {
            const rawLabel = String(it.label || it.key || '');
            const labelKey = rawLabel.toLowerCase();
            const localizedLabel = lockBenchmarkLabelWrap((benchmarkLabelMap[currentLang] && benchmarkLabelMap[currentLang][labelKey]) || rawLabel || labelKey);
            const v = (typeof it.pct === 'number' && isFinite(it.pct)) ? it.pct : 0;
            const width = Math.max(3, Math.min(100, (Math.abs(v) / maxAbs) * 100));
            const cls = v >= 0 ? 'pos' : 'neg';
            const txt = v.toFixed(2) + '%';
            const isDax = (labelKey === 'daxsnack');
            const labelCls = isDax ? 'metric-label metric-label-em' : 'metric-label';
            const badgeCls = isDax ? 'metric-badge metric-badge-em' : 'metric-badge';
            return (
              '<div class="metric-line chart-line">' +
                '<span class="' + labelCls + '">' + localizedLabel + '</span>' +
                '<div class="metric-bar metric-bar-' + cls + '" title="' + txt + '">' +
                  '<div class="metric-bar-fill" style="width:' + width + '%;"></div>' +
                '</div>' +
                '<span class="' + badgeCls + '">' + txt + '</span>' +
              '</div>'
            );
          }).join('');
          const benchTitle = dict.benchmark_title || 'product comparison';
          const benchSince = dict.benchmark_since || 'performance since configured start';
          host.innerHTML = (
            '<h2 class="setup-metrics-title">' + escapeHtml(benchTitle) + '</h2>' +
            '<div class="benchmark-since">' + escapeHtml(benchSince) + '</div>' +
            '<div class="metric-card">' + rows + '</div>'
          );
          host.style.display = '';
        }

        function startSnapshotPolling(name, url, intervalMs, applyPayload) {
          if (!url || !window.fetch) return null;
          const state = {
            timer: null,
            inFlight: false,
            stopped: false,
            failures: 0,
            controller: null,
          };

          function nextDelay() {
            const multiplier = Math.pow(2, Math.min(state.failures, 3));
            const base = Math.min(60000, intervalMs * multiplier);
            return base + Math.floor(Math.random() * Math.max(1, base * 0.1));
          }

          function schedule(delayMs) {
            if (state.stopped) return;
            if (state.timer) clearTimeout(state.timer);
            state.timer = setTimeout(poll, delayMs);
          }

          function poll() {
            state.timer = null;
            if (state.stopped || state.inFlight) return;
            if (document.hidden) {
              schedule(intervalMs);
              return;
            }
            state.inFlight = true;
            const controller = window.AbortController ? new AbortController() : null;
            const timeoutId = controller ? setTimeout(function () { controller.abort(); }, 8000) : null;
            state.controller = controller;
            const requestOptions = {
              method: 'GET',
              credentials: 'same-origin',
              headers: { 'Accept': 'application/json' },
            };
            if (controller) requestOptions.signal = controller.signal;
            fetch(url, requestOptions)
              .then(function (response) {
                if (!response.ok) throw new Error('snapshot request failed');
                return response.json();
              })
              .then(function (payload) {
                state.failures = 0;
                applyPayload(payload);
              })
              .catch(function () {
                state.failures += 1;
              })
              .then(function () {
                if (timeoutId) clearTimeout(timeoutId);
                state.controller = null;
                state.inFlight = false;
                schedule(nextDelay());
              });
          }

          function handleVisibilityChange() {
            if (!document.hidden && !state.inFlight) schedule(0);
          }

          state.stop = function () {
            state.stopped = true;
            if (state.timer) clearTimeout(state.timer);
            if (state.controller) state.controller.abort();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
          };
          document.addEventListener('visibilitychange', handleVisibilityChange);
          window.addEventListener('pagehide', state.stop, { once: true });
          window[name] = state;
          schedule(0);
          return state;
        }

        function startBenchmarkPolling() {
          if (benchPollStarted) return;
          if (!benchmarkSnapshotUrl || !window.fetch) return;
          benchPollStarted = true;
          startSnapshotPolling('_bench_poll', benchmarkSnapshotUrl, 15000, function (payload) {
            if (!Array.isArray(payload)) return;
            const out = [];
            payload.forEach((it) => {
              if (!it || typeof it !== 'object') return;
              const keyRaw = String(it.key || it.epic || '').toUpperCase();
              if (!BENCHMARK_LABELS[keyRaw]) return;
              const pct = Number(it.pct);
              if (!isFinite(pct)) return;
              const label = BENCHMARK_LABELS[keyRaw];
              out.push({
                key: (keyRaw === 'DAXSNACK') ? 'daxsnack' : keyRaw,
                label: label,
                pct: pct,
              });
            });
            if (!out.length) return;
            out.sort((a, b) => b.pct - a.pct);
            injectedBenchmarkRanking = out;
            renderBenchmarkComparison();
          });
        }

        function resolveOpenTradePrice(update, side) {
          const bid = (update && typeof update.bid === 'number') ? update.bid : null;
          const ask = (update && typeof update.ask === 'number') ? update.ask : null;
          const mid = (update && typeof update.mid === 'number') ? update.mid : null;
          if (side === 'long') {
            if (bid != null) return bid;
            if (mid != null) return mid;
            if (ask != null) return ask;
          } else if (side === 'short') {
            if (ask != null) return ask;
            if (mid != null) return mid;
            if (bid != null) return bid;
          } else {
            if (mid != null) return mid;
            if (bid != null) return bid;
            if (ask != null) return ask;
          }
          return null;
        }

        function buildRunningCardKey(rIt) {
          try {
            const rInst = (rIt && rIt.instrument) ? rIt.instrument : {};
            const rSide = (rIt && rIt.side ? String(rIt.side).toLowerCase() : '');
            const rEpic = (rInst.epic || rInst.symbol || '').toString().toUpperCase();
            const rTime = (rIt && (rIt.entry_time_utc || rIt.executed_at_utc || (rIt.raw && rIt.raw.entry_time_utc) || rIt.date || '')) || '';
            return [rEpic, rSide, String(rTime)].join('|');
          } catch (_) {
            return '';
          }
        }

        function computeRunningRetInlineHtml(it, side) {
          let retInline = '';
          try {
            const st = it.status || {};
            const entryNumInline = (typeof it.entry === 'number') ? it.entry : null;
            const lastCloseInline = (st && typeof st.last_close === 'number') ? st.last_close : null;
            if (entryNumInline != null && entryNumInline > 0 && lastCloseInline != null) {
              const movePct = ((lastCloseInline - entryNumInline) / entryNumInline) * 100.0;
              let tri = '';
              let sgn = '';
              let cls = '';
              if (movePct > 0) { tri = '▲&nbsp;'; sgn = '+'; cls = 'return-pos'; }
              else if (movePct < 0) { tri = '▼&nbsp;'; sgn = '-'; cls = 'return-neg'; }
              else {
                // Exactly 0.0% → color by side: green for long, red for short
                if (side === 'long') { tri = '▲&nbsp;'; cls = 'return-pos'; }
                else if (side === 'short') { tri = '▼&nbsp;'; cls = 'return-neg'; }
              }
              const pct = Math.abs(movePct).toFixed(2) + '\u00A0%';
              const valueHtml = cls ? ('<span class="' + cls + '">' + tri + sgn + pct + '</span>') : (tri + sgn + pct);
              retInline = '&nbsp;' + valueHtml;
            }
          } catch (_) {}
          return retInline;
        }

        function computeRunningProfitValueHtml(it, side, t) {
          let profitValueHtml = '';
          try {
            const st = it.status || {};
            const stoppedOut = (st && (st.stopped_out === true || st.stopped_out_local === true));
            const entryNum = (typeof it.entry === 'number') ? it.entry : null;
            const lastClose = (st && typeof st.last_close === 'number') ? st.last_close : null;
            const stopNum = (typeof it.stop === 'number') ? it.stop : null;
            const initStopNum = (typeof it.initial_stop === 'number') ? it.initial_stop : null;
            const riskPctVal = (typeof it.risk_pct_initial === 'number' && Number.isFinite(it.risk_pct_initial))
              ? it.risk_pct_initial
              : ((typeof it.risk_pct === 'number' && Number.isFinite(it.risk_pct)) ? it.risk_pct : null);
            let profitPct = null;
            if (entryNum != null && (side === 'long' || side === 'short') && riskPctVal != null) {
              // Choose the price to compare against: use current close when open; stop if stopped
              let exitPrice = null;
              if (stoppedOut === true && stopNum != null) {
                exitPrice = stopNum;
              } else if (lastClose != null) {
                exitPrice = lastClose;
              } else if (stopNum != null) {
                exitPrice = stopNum;
              }
              // Use initial stop distance when available to keep risk reference stable under trailing
              const baseStop = (initStopNum != null) ? initStopNum : stopNum;
              if (exitPrice != null && baseStop != null) {
                const dist = (side === 'long') ? (entryNum - baseStop) : (baseStop - entryNum);
                const move = (side === 'long') ? (exitPrice - entryNum) : (entryNum - exitPrice);
                if (typeof dist === 'number' && dist > 0) {
                  // PnL% of equity ≈ (move/stopDist) * risk%
                  profitPct = (move / dist) * (riskPctVal * 100.0);
                }
              }
            }
            if (profitPct == null || !Number.isFinite(profitPct)) {
              const serverPct = (typeof it.pnl_pct_r === 'number' && Number.isFinite(it.pnl_pct_r))
                ? it.pnl_pct_r
                : ((st && typeof st.pnl_pct_r === 'number' && Number.isFinite(st.pnl_pct_r)) ? st.pnl_pct_r : null);
              if (serverPct != null) {
                profitPct = serverPct;
              }
            }
            if (profitPct != null && Number.isFinite(profitPct)) {
              const s2 = profitPct > 0 ? '+' : (profitPct < 0 ? '-' : '');
              const c2 = profitPct > 0 ? 'return-pos' : (profitPct < 0 ? 'return-neg' : '');
              const p2 = Math.abs(profitPct).toFixed(2) + '\u00A0%';
              // Do not show triangle next to profit label
              const v2 = c2 ? ('<span class="' + c2 + '">' + s2 + p2 + '</span>') : (s2 + p2);
              profitValueHtml = (t.label_pnl || 'profit') + ':&nbsp;' + v2;
            }
          } catch (_) {}
          return profitValueHtml;
        }

        function refreshRunningCardsLiveMetrics() {
          try {
            const listEl = document.getElementById('running-list');
            if (!listEl) return;
            const items = (injectedRunning && Array.isArray(injectedRunning.items)) ? injectedRunning.items : [];
            if (!items.length) return;
            const openItems = items.filter(function (it) { return it && it.status && it.status.open === true; });
            if (!openItems.length) return;
            const t = i18n[currentLang] || i18n.en;
            const cardByKey = new Map();
            listEl.querySelectorAll('.running-card[data-running-card-key]').forEach(function (el) {
              const key = el.getAttribute('data-running-card-key') || '';
              if (key) cardByKey.set(key, el);
            });
            openItems.forEach(function (it) {
              const side = (it && it.side ? String(it.side).toLowerCase() : '');
              const key = buildRunningCardKey(it);
              if (!key) return;
              const cardEl = cardByKey.get(key);
              if (!cardEl) return;
              const retEl = cardEl.querySelector('.running-ret-inline');
              if (retEl) retEl.innerHTML = computeRunningRetInlineHtml(it, side) || '';
              const profitEl = cardEl.querySelector('.running-profit-inline');
              if (profitEl) profitEl.innerHTML = computeRunningProfitValueHtml(it, side, t) || '';
            });
          } catch (_) {}
        }

        function scheduleOpenTradesRender() {
          // Keep inline running charts mounted; stream updates should only refresh
          // numbers, not rebuild cards/charts.
          if (openTradesRenderPending) return;
          openTradesRenderPending = true;
          setTimeout(function () {
            openTradesRenderPending = false;
            try { refreshRunningCardsLiveMetrics(); } catch (_) {}
          }, 120);
        }

        function applyOpenTradeUpdates(payload) {
          if (!Array.isArray(payload)) return;
          const items = (injectedRunning && Array.isArray(injectedRunning.items)) ? injectedRunning.items : [];
          if (!items.length) return;
          let changed = false;
          payload.forEach((upd) => {
            if (!upd || typeof upd !== 'object') return;
            const ep = String(upd.epic || '').toUpperCase();
            if (!openTradesAllowed[ep]) return;
            items.forEach((it) => {
              if (!it || typeof it !== 'object') return;
              const inst = it.instrument || {};
              const itEp = String(inst.epic || inst.symbol || '').toUpperCase();
              if (itEp !== ep) return;
              const side = String(it.side || '').toLowerCase();
              const px = resolveOpenTradePrice(upd, side);
              if (px == null) return;
              const key = ep + ':' + side;
              if (openTradesLastPx[key] === px) return;
              openTradesLastPx[key] = px;
              if (!it.status || typeof it.status !== 'object') it.status = {};
              it.status.last_close = px;
              changed = true;
            });
          });
          if (changed) scheduleOpenTradesRender();
        }

        function startOpenTradesPolling() {
          if (openTradesPollStarted) return;
          if (!openTradesSnapshotUrl || !window.fetch) return;
          if (!openTradesAllowed || !Object.keys(openTradesAllowed).length) return;
          openTradesPollStarted = true;
          startSnapshotPolling('_open_trades_poll', openTradesSnapshotUrl, 5000, applyOpenTradeUpdates);
        }

        function setContent(data) {
          try { window._dax_last_data = data; } catch (_) {}
          const best = (data && data.best) || {};
          const isNextDayTouch = !!(data && data.next_day_touch);
          const todayList = document.getElementById('today-list');
          const lastCheckEl = document.getElementById('setup-last-check');
          if (lastCheckEl) { lastCheckEl.textContent = ''; lastCheckEl.style.display = 'none'; }
          if (todayList) {
            todayList.innerHTML = '';
            todayList.style.display = '';
          }

          // Determine today's date in UTC (YYYY-MM-DD)
          var todayStr = (new Date()).toISOString().slice(0, 10);

          // Choose main best:
          // - Prefer latest from aggregated same-day setups
          // - If today's best is a fallback/empty, prefer the latest aggregator item even if it is from yesterday
          var mainBest = isNextDayTouch ? {} : (best || {});
          var agg = null; // hoist for later checks
          var aggOrdered = null;
          var itemsToday = [];
          var setupOrder = [];
          function itemTs(it) {
            if (!it || typeof it !== 'object') return 0;
            var t = it.executed_at_utc || it.generated_at_utc || it.date || null;
            if (!t || typeof t !== 'string') return 0;
            try {
              if (t.indexOf('T') === -1 && t.length >= 10) {
                return Date.parse(t.slice(0, 10) + 'T00:00:00Z') || 0;
              }
              return Date.parse(t) || 0;
            } catch (_) { return 0; }
          }
          function itemDate(it) {
            if (!it || typeof it !== 'object') return null;
            var t = it.executed_at_utc || it.generated_at_utc || it.date || null;
            if (!t || typeof t !== 'string') return null;
            try {
              if (t.indexOf('T') === -1) return t.slice(0, 10);
              var d = new Date(t);
              if (!isNaN(d)) return d.toISOString().slice(0, 10);
            } catch (_) {}
            return null;
          }
          function itemsForToday(aggObj) {
            var out = [];
            try {
              if (!aggObj || typeof aggObj !== 'object') return out;
              var arr = Array.isArray(aggObj.items) ? aggObj.items : [];
              for (var i = 0; i < arr.length; i++) {
                if (itemDate(arr[i]) === todayStr) out.push(arr[i]);
              }
            } catch (_) {}
            return out;
          }
          function setupKey(it) {
            if (!it || !it.instrument) return null;
            var inst = it.instrument || {};
            var ep = (inst.epic || '').toString().toUpperCase();
            var sym = (inst.symbol || '').toString().toUpperCase();
            return ep || sym || null;
          }
          function addSetupKey(it) {
            try {
              var k = setupKey(it);
              if (!k) return;
              if (setupOrder.indexOf(k) === -1) setupOrder.push(k);
            } catch (_) {}
          }
          try {
            agg = injectedDaySetups;
            if (agg && typeof agg === 'object' && Array.isArray(agg.items) && agg.items.length > 0) {
              var items = agg.items.slice();
              items.sort(function(a,b){
                var ta = itemTs(a);
                var tb = itemTs(b);
                return tb - ta;
              });
              aggOrdered = Object.assign({}, agg, { items: items });
              if (items.length > 0) {
                // Use aggregator when it represents today (date field or newest item's UTC date)
                var latest = items[0];
                if (isNextDayTouch) {
                  itemsToday = items.slice();
                  if (itemsToday.length > 0) {
                    mainBest = itemsToday[0];
                  }
                } else {
                  var useAgg = false;
                  try {
                    var dateField = (agg.date || '').toString();
                    var latestDate = itemDate(latest);
                    useAgg = (String(dateField) === todayStr) || (latestDate === todayStr);
                  } catch (_) { useAgg = false; }
                  // If today's best is a fallback/empty, prefer the latest real aggregator item
                  // regardless of date, so we show yesterday's found setup instead of a dummy fallback.
                  if (!useAgg && !isNextDayTouch) {
                    try {
                      var rawBest = (best && best.raw) || {};
                      var isBestFallback = !!rawBest._fallback;
                      // Treat missing actionable fields as fallback-ish
                      var missingAction = !(best && (best.side && best.entry != null && best.stop != null));
                      if (isBestFallback || missingAction) {
                        useAgg = true;
                      }
                    } catch (_) { /* noop */ }
                  }
                  if (useAgg) mainBest = latest;
                }
              }
            }
          } catch (_) {}

          // Track the primary setup instrument for downstream ordering (even if not rendered)
          try {
            var mbKey = setupKey(mainBest);
            if (mbKey) addSetupKey(mainBest);
          } catch (_) {}

          const inst = (mainBest && mainBest.instrument) || {};
          const scores = (mainBest && mainBest.scores) || {};

          const name = inst.name || inst.symbol || '—';
          const symbol = inst.epic || inst.symbol || '—';
          const strat = (mainBest && mainBest.strategy) || '—';
          const side = (mainBest && mainBest.side) || '—';
          const entry = (mainBest && mainBest.entry_price_est != null)
            ? mainBest.entry_price_est
            : (mainBest && mainBest.entry != null ? mainBest.entry : '—');
          const stop = (mainBest && mainBest.stop != null ? mainBest.stop : '—');
          // Display values with same 4dp-trim formatting used elsewhere
          const entryDisplayMain = formatPx(entry);
          const stopDisplayMain = formatPx(stop);
          const date = (mainBest && mainBest.date) || (data.generated_at_utc ? data.generated_at_utc.split('T')[0] : '—');

          const strat_lc = String(strat).toLowerCase();
          const side_lc = String(side).toLowerCase();
          const rawHdr = (mainBest && mainBest.raw) || {};
          const isFallbackHdr = !!rawHdr._fallback;

          // Track whether there is no setup for TODAY (date mismatch or explicit fallback)
          // so running-setups can drive the chart symbol. This must be based on the
          // "effective" best (aggregated same-day best or `mainBest`), not the raw `best`.
          var mainDate = (mainBest && mainBest.date) || null;
          var genDate = (data && data.generated_at_utc ? data.generated_at_utc.split('T')[0] : null);
          // Determine whether we effectively have a same-day setup/run
          var agToday = false;
          var hasTodayAggItems = false;
          try {
            if (isNextDayTouch) {
              if (!itemsToday.length) {
                var srcAgg = aggOrdered || agg;
                if (srcAgg && Array.isArray(srcAgg.items) && srcAgg.items.length > 0) {
                  itemsToday = srcAgg.items.slice();
                }
              }
              hasTodayAggItems = (itemsToday.length > 0);
              agToday = hasTodayAggItems;
            } else if (agg && typeof agg === 'object') {
              var hasItems = Array.isArray(agg.items) && agg.items.length > 0;
              var dateField = (agg.date || '').toString();
              var lastGen = (agg.last_generated_at_utc || '').toString();
              // Compute latest item generation date (UTC) if available
              var latestItemDate = null;
              if (hasItems) {
                try {
                  var maxTs = 0;
                  for (var i = 0; i < agg.items.length; i++) {
                    var gi = itemTs(agg.items[i]);
                    if (gi > maxTs) maxTs = gi;
                  }
                  if (maxTs > 0) {
                    var d = new Date(maxTs);
                    latestItemDate = d.toISOString().slice(0,10);
                  }
                } catch (_) { latestItemDate = null; }
              }
              var lastGenDate = null;
              try { if (lastGen) lastGenDate = new Date(lastGen).toISOString().slice(0,10); } catch (_) { lastGenDate = null; }
              agToday = (
                (dateField && String(dateField) === todayStr) ||
                (latestItemDate && latestItemDate === todayStr) ||
                (lastGenDate && lastGenDate === todayStr)
              );
              hasTodayAggItems = !!(hasItems && ((String(dateField) === todayStr) || (latestItemDate === todayStr)));
            }
          } catch (_) {}

          var isTodayEffective = agToday || (String((mainDate || genDate || '')) === todayStr);
          // Detect if there was any run today (either setup_of_the_day.json or aggregator indicates today)
          var setupRunToday = (String(genDate || '') === todayStr);
          var hasTodayRun = !!(agToday || setupRunToday);
          // Consider a setup present if either the aggregator has same-day items or the mainBest itself is a real, non-fallback for today
          var hasAnyTodaySetup = !!(hasTodayAggItems || ((String(mainDate || '') === todayStr) && !isFallbackHdr));
          var hasAnySetupDisplayed = hasAnyTodaySetup;
          // Only show fallback when there WAS a run today but it produced no same-day setup
          var shouldFallback = (hasTodayRun && !hasAnyTodaySetup);
          if (isNextDayTouch) {
            isTodayEffective = hasTodayAggItems;
            hasTodayRun = hasTodayAggItems;
            hasAnyTodaySetup = hasTodayAggItems;
            shouldFallback = !hasTodayAggItems;
          }
          try { window._fallback_mode = !!shouldFallback; } catch (_) { window._fallback_mode = !!shouldFallback; }
          // If today's date does not match the best item's date (e.g., weekend),
          // render the clear "no setup found" state using today's date.
          if (shouldFallback) {
            const tloc = i18n[currentLang] || i18n.en;
            const lastCheckIso = (isNextDayTouch && agg && agg.last_generated_at_utc)
              ? agg.last_generated_at_utc
              : (data && data.generated_at_utc ? data.generated_at_utc : null);
            const lastCheck = (lastCheckIso ? lastCheckIso.split('T')[0] : (date || '—'));
            const lastCheckDisplay = formatDateDisplay(lastCheck);
            // 1) Title should read "Setup Of The Day" (same styling as running trades header)
            document.getElementById('inst-name').textContent = (tloc.setup_of_the_day || 'Setup Of The Day');
            // 2) Do not prefix with "last check"; move date into the card and keep subtitle minimal

            // 3) Show a card with the last check date and an instrument line "no setup found"
            try {
              if (todayList) {
                const nm = (tloc.no_setup_found || 'no setup found');
                const card = document.createElement('div');
                card.className = 'running-card money-flash-box';
                card.innerHTML = (
                  '<div class="running-hdr">' +
                  '<p class="running-title">' + escapeHtml(lastCheckDisplay) + '</p>' +
                  '</div>' +
                  '<div class="running-meta">' + escapeHtml(nm) + '</div>'
                );
                appendSetupCard(todayList, card, 'last_check', lastCheckIso || null);
                todayList.style.display = '';
              }
            } catch (_) {}
          } else {
            const tloc = i18n[currentLang] || i18n.en;
            document.getElementById('inst-name').textContent = (tloc.setup_of_the_day || 'Setup Of The Day');

            // Render a card: if not actionable, show a clear "no setup found" message
            try {
              const t = i18n[currentLang] || i18n.en;
              if (todayList) {
                let hasActionable = !!(mainBest && mainBest.instrument && (mainBest.instrument.epic || mainBest.instrument.symbol)
                                         && mainBest.side && ((mainBest.entry != null) || (mainBest.entry_price_est != null)) && (mainBest.stop != null));
                if (!hasActionable || isFallbackHdr) {
                  const lastCheckIso = (isNextDayTouch && agg && agg.last_generated_at_utc)
                    ? agg.last_generated_at_utc
                    : (data && data.generated_at_utc ? data.generated_at_utc : null);
                  const lastCheck = (lastCheckIso ? lastCheckIso.split('T')[0] : (date || '—'));
                  const lastCheckDisplay = formatDateDisplay(lastCheck);
                  const nm = (t.no_setup_found || 'no setup found');
                  const card = document.createElement('div');
                  card.className = 'running-card money-flash-box';
                  card.innerHTML = (
                    '<div class="running-hdr">' +
                    '<p class="running-title">' + escapeHtml(lastCheckDisplay) + '</p>' +
                    '</div>' +
                    '<div class="running-meta">' + escapeHtml(nm) + '</div>'
                  );
                  appendSetupCard(todayList, card, 'last_check', lastCheckIso || null);
                  todayList.style.display = '';
                } else {
                  hasAnySetupDisplayed = true;
                  const sideTxt = String(side_lc || '—').toLowerCase();
                  // Direction triangle: green up for long, red down for short (same as running trades)
                  let dirInline = '';
                  try {
                    if (sideTxt === 'long') dirInline = '&nbsp;<span class="return-pos">▲</span>';
                    else if (sideTxt === 'short') dirInline = '&nbsp;<span class="return-neg">▼</span>';
                  } catch (_) {}
                  const card = document.createElement('div');
                  card.className = 'running-card money-flash-box';
                  const mainCheckIso = setupItemIso(mainBest, (data && data.generated_at_utc) || null);
                  const dateDisplay = formatDateDisplay(date);
                  const isNew = isRecentIso(mainCheckIso, 12);
                  const newLabel = (t.pill_new || 'new');
                  const pillWrap = isNew
                    ? ('<div class="pill-wrap"><span class="status-pill status-new">' + escapeHtml(newLabel) + '</span></div>')
                    : '';
                  card.innerHTML = (
                    '<div class="running-hdr">' +
                    '<p class="running-title">' + escapeHtml(dateDisplay) + '</p>' +
                    pillWrap +
                    '</div>' +
                    '<div class="running-meta">' +
                      '<span class="nocaps inst-strong">' + withNbsp(name) + '</span>' + ' (' + '<span class="nocaps">' + withNbsp(symbol) + '</span>' + ')' + (dirInline || '') +
                    '</div>' +
                    '<div class="running-meta">' + '<span class="side-strong">' + escapeHtml(sideTxt) + '</span>' + ' • ' + escapeHtml(t.label_entry || 'entry') + ':&nbsp;' + entryDisplayMain + ' • ' + escapeHtml(t.label_stop || 'stop') + ':&nbsp;' + stopDisplayMain + '</div>'
                  );
                  appendSetupCard(todayList, card, 'setup_found', mainCheckIso);
                  todayList.style.display = '';
                  try { addSetupKey(mainBest); } catch (_) {}
                }
              }
            } catch (_) {}
          }

          // Hide any legacy explain block content
          try {
            const eb = document.getElementById('explain-block');
            if (eb) { eb.textContent = ''; eb.style.display = 'none'; }
          } catch (_) {}



          // Render additional same-day setups (from aggregator), excluding the primary best
          var otherSetupsCount = 0;
          var aggDisplay = aggOrdered || agg;
          try {
            if (isNextDayTouch) {
              if (itemsToday.length > 0) {
                aggDisplay = {
                  date: (agg && agg.date) ? agg.date : todayStr,
                  items: itemsToday,
                  last_generated_at_utc: (agg && agg.last_generated_at_utc) ? agg.last_generated_at_utc : null,
                };
              } else {
                aggDisplay = null;
              }
            }
          } catch (_) {}
          try { otherSetupsCount = renderOtherSetups(aggDisplay, mainBest, todayList, setupOrder); } catch (_) { otherSetupsCount = 0; }
          if (otherSetupsCount > 0) { hasAnySetupDisplayed = true; }

          // Surface the displayed setup order for downstream consumers (running trades UI)
          try { window._setup_display_order = setupOrder.slice(); } catch (_) {}


          // Render realized stats under the setup card(s)
          try {
            renderSetupMetrics(mainBest, aggDisplay || aggOrdered || agg, { hasAnyTodaySetup: hasAnyTodaySetup, hasAnySetupDisplayed: hasAnySetupDisplayed });
            renderBenchmarkComparison();
            startBenchmarkPolling();
            startOpenTradesPolling();
          } catch (_) {}

          // Populate estimated annual return value if provided
          try {
            var ann = (typeof estAnnualReturn === 'number') ? estAnnualReturn : null;
            if (ann !== null && isFinite(ann)) {
              var txt = ann.toFixed(2) + '%';
              var v1 = document.getElementById('acc-ann-value-right');
              var v2 = document.getElementById('acc-ann-value-only');
              if (v1) v1.textContent = txt;
              if (v2) v2.textContent = txt;
            }
          } catch (_) {}

          // Determine TradingView symbol with clear priority:
          // 1) If there are running trades, use the top running trade (same ordering as UI)
          // 2) Else, use Coffee Arabica
          // 3) Manual override from running-card control (applied below) wins
          function toTVSymbol(instObj) {
            if (!instObj || typeof instObj !== 'object') return null;
            var ep = instObj.epic || null;
            var sym = instObj.symbol || null;
            if (ep) return 'CAPITALCOM:' + String(ep);
            if (sym) {
              var s = String(sym);
              return (s.indexOf(':') > -1) ? s : ('CAPITALCOM:' + s);
            }
            return null;
          }

          var tvsym = null;
          try {
            var allR = (injectedRunning && Array.isArray(injectedRunning.items)) ? injectedRunning.items : [];
            var openR = allR.filter(function (it) { return it && it.status && it.status.open === true; });
            if (openR.length > 0) {
              // Reorder to mirror UI list: setup display order first, then original order as tiebreaker
              var orderArr = (typeof window !== 'undefined' && Array.isArray(window._setup_display_order)) ? window._setup_display_order : [];
              var orderMap = new Map();
              orderArr.forEach(function(k, idx){ if (!orderMap.has(k)) orderMap.set(k, idx); });
              var keyFor = function(it){
                if (!it || !it.instrument) return '';
                var inst = it.instrument || {};
                var ep = (inst.epic || '').toString().toUpperCase();
                var sym = (inst.symbol || '').toString().toUpperCase();
                return ep || sym || '';
              };
              var ranked = openR.map(function(it, idx){
                var k = keyFor(it);
                var ord = orderMap.has(k) ? orderMap.get(k) : Number.MAX_SAFE_INTEGER;
                return { it: it, idx: idx, ord: ord };
              }).sort(function(a,b){
                if (a.ord !== b.ord) return a.ord - b.ord;
                return a.idx - b.idx;
              });
              var newest = ranked.length ? ranked[0].it : null;
              tvsym = toTVSymbol(newest && newest.instrument || {});
            }
          } catch (_) {}
          // Generic example chart used only while the operator has no setup data.
          if (!tvsym) tvsym = 'CAPITALCOM:US500';
          // Manual override from running-card control
          try {
            var manualTv = toCapitalTvSymbol(window._dax_tv_manual_symbol || null);
            if (manualTv) tvsym = manualTv;
          } catch (_) {}

          setTopTVSymbol(tvsym);

          // Keep page title constant for branding/SEO
          document.title = 'daxsnack | one daily trade setup';
        }

        function renderOtherSetups(agg, best, listEl, orderCollector) {
          // Render additional same-day setups into the Today section as cards
          const list = listEl || document.getElementById('today-list');
          if (!list) return 0;
          if (!agg || typeof agg !== 'object') return 0;
          const items = Array.isArray(agg.items) ? agg.items : [];
          if (!items.length) return 0;
          const bInst = (best && best.instrument) || {};
          const bKey = ((bInst.epic || '').toUpperCase()) + '|' + String(best.strategy || '').toLowerCase() + '|' + String(best.side || '').toLowerCase();
          let count = 0;
          items.forEach(function (it) {
            if (!it || typeof it !== 'object') return;
            const inst = it.instrument || {};
            const key = ((inst.epic || '').toUpperCase()) + '|' + String(it.strategy || '').toLowerCase() + '|' + String(it.side || '').toLowerCase();
            if (key === bKey) return; // skip the primary best
            try {
              if (orderCollector && Array.isArray(orderCollector)) {
                const ordKey = ((inst.epic || inst.symbol || '')).toString().toUpperCase();
                if (ordKey && !orderCollector.includes(ordKey)) {
                  orderCollector.push(ordKey);
                }
              }
            } catch (_) {}
            const name = inst.name || inst.symbol || '—';
            const symbol = inst.epic || inst.symbol || '—';
            const side = (it.side || '—').toString().toLowerCase();
            const entry = (it.entry_price_est != null ? it.entry_price_est : (it.entry != null ? it.entry : '—'));
            const stop = (it.stop != null ? it.stop : '—');
            const entryDisplay = formatPx(entry);
            const stopDisplay = formatPx(stop);
            const date = it.date || (agg.date || '—');
            const dateDisplay = formatDateDisplay(date);
            const t = i18n[currentLang] || i18n.en;
            const div = document.createElement('div');
            div.className = 'running-card money-flash-box';
            const setupIso = setupItemIso(it, (agg && agg.last_generated_at_utc) || null);
            const isNew = isRecentIso(setupIso, 12);
            const newLabel = (t.pill_new || 'new');
            const pillWrap = isNew
              ? ('<div class="pill-wrap"><span class="status-pill status-new">' + escapeHtml(newLabel) + '</span></div>')
              : '';
            // Direction triangle: green up for long, red down for short (same as running trades)
            let dirInline = '';
            try {
              if (side === 'long') dirInline = '&nbsp;<span class=\"return-pos\">▲</span>';
              else if (side === 'short') dirInline = '&nbsp;<span class=\"return-neg\">▼</span>';
            } catch (_) {}
            const sideTxt = String(side || '—').toLowerCase();
            div.innerHTML = (
              '<div class="running-hdr">' +
              '<p class="running-title">' + escapeHtml(dateDisplay) + '</p>' +
              pillWrap +
              '</div>' +
              '<div class="running-meta">' +
                '<span class="nocaps inst-strong">' + withNbsp(name) + '</span>' + ' (' + '<span class="nocaps">' + withNbsp(symbol) + '</span>' + ')' + (dirInline || '') +
              '</div>' +
              '<div class="running-meta">' + '<span class="side-strong">' + escapeHtml(sideTxt) + '</span>' + ' • ' + escapeHtml(t.label_entry || 'entry') + ':&nbsp;' + entryDisplay + ' • ' + escapeHtml(t.label_stop || 'stop') + ':&nbsp;' + stopDisplay + '</div>'
            );
            appendSetupCard(list, div, 'setup_found', setupItemIso(it, (agg && agg.last_generated_at_utc) || null));
            count += 1;
          });
          if (count > 0) { list.style.display = ''; }
          return count;
        }

        function updateLastCheckLine(payload, agg, mainBest, opts) {
          const el = document.getElementById('setup-last-check');
          if (!el) return;
          const hasSetupDisplayed = !!(opts && opts.hasAnySetupDisplayed);
          const isoCandidates = [];
          const pushIso = (val) => {
            if (!val || typeof val !== 'string') return;
            const trimmed = val.trim();
            if (!trimmed) return;
            isoCandidates.push(trimmed);
          };
          try { pushIso(payload && payload.generated_at_utc); } catch (_) {}
          try { pushIso(mainBest && mainBest.generated_at_utc); } catch (_) {}
          if (agg && typeof agg === 'object') {
            try { pushIso(agg.last_generated_at_utc); } catch (_) {}
            try {
              const items = Array.isArray(agg.items) ? agg.items : [];
              for (let i = 0; i < items.length; i++) {
                pushIso(items[i] && items[i].generated_at_utc);
              }
            } catch (_) {}
          }
          let newestIso = null;
          let newestTs = -Infinity;
          for (let i = 0; i < isoCandidates.length; i++) {
            const iso = isoCandidates[i];
            const ts = Date.parse(iso);
            if (isNaN(ts)) continue;
            if (ts > newestTs) {
              newestTs = ts;
              newestIso = iso;
            }
          }
          if (!newestIso) {
            el.style.display = 'none';
            el.textContent = '';
            return;
          }
          let formatted = null;
          try {
            const dt = new Date(newestIso);
            if (!isNaN(dt.getTime())) {
              const hh = String(dt.getUTCHours()).padStart(2, '0');
              const mm = String(dt.getUTCMinutes()).padStart(2, '0');
              formatted = hh + ':' + mm + ' UTC';
            }
          } catch (_) {}
          if (!formatted) {
            el.style.display = 'none';
            el.textContent = '';
            return;
          }
          el.textContent = formatted;
          el.style.display = '';
        }

        function normalizeData(data) {
          // If already in modern shape with a real best, keep as is
          if (data && typeof data === 'object' && data.best) {
            return data;
          }
          // If payload missing or not an object, force an explicit fallback that
          // drives the "no setup found" UI state for today (never an empty card).
          if (!data || typeof data !== 'object') {
            const nowIso = new Date().toISOString();
            const today = nowIso.slice(0, 10);
            const fb = {
              date: today,
              instrument: { name: '—', symbol: '—', epic: null },
              strategy: '—',
              side: null,
              entry: null,
              stop: null,
              scores: { win_rate: null, ann_return: null, tpm: null },
              raw: { _fallback: true },
            };
            return { best: fb, generated_at_utc: nowIso };
          }

          // If "best" is missing or null, decide between an explicit fallback payload
          // (so the UI shows the empty-state message + last check) or mapping an older
          // flat JSON shape into the new structure.
          const hasOldFlatShape = (
            Object.prototype.hasOwnProperty.call(data, 'epic') ||
            Object.prototype.hasOwnProperty.call(data, 'symbol') ||
            Object.prototype.hasOwnProperty.call(data, 'instrument') ||
            Object.prototype.hasOwnProperty.call(data, 'ticker') ||
            Object.prototype.hasOwnProperty.call(data, 'name') ||
            Object.prototype.hasOwnProperty.call(data, 'strategy')
          );

          if (!data.best && !hasOldFlatShape) {
            // Create a clear fallback so the UI renders the proper empty state.
            // Also ensure it is considered a "today" run by providing a current timestamp.
            const nowIso = data.generated_at_utc || new Date().toISOString();
            const today = String(nowIso).split('T')[0];
            const fb = {
              date: today,
              instrument: { name: '—', symbol: '—', epic: null },
              strategy: '—',
              side: null,
              entry: null,
              stop: null,
              scores: { win_rate: null, ann_return: null, tpm: null },
              raw: { _fallback: true },
            };
            return { best: fb, generated_at_utc: nowIso };
          }

          // Support older flat JSON shape: { name: <strategy>, symbol: <instrument name>, epic: <code>, ... }
          const epic = data.epic || null;
          const nameForText = data.instrument || data.symbol || data.ticker || epic || '—';
          const symbolForText = epic || data.ticker || data.symbol || '—';
          const best = {
            instrument: { name: nameForText, symbol: symbolForText, epic: epic },
            strategy: data.name || data.strategy || '—',
            side: data.side || '—',
            entry: data.entry ?? null,
            stop: data.stop ?? null,
            scores: {
              win_rate: (data.win_rate != null ? data.win_rate : (data.win_ratio != null ? data.win_ratio : null)),
              ann_return: data.ann_return != null ? data.ann_return : null,
              tpm: data.tpm != null ? data.tpm : null,
            },
            date: data.date || null,
            raw: data,
          };
          return { best: best, generated_at_utc: data.generated_at_utc || null };
        }

        function loadData() {
          // Always invoke setContent so fallback-mode logic runs even when
          // today's setup payload is missing or null. This ensures we still
          // create a TradingView widget driven by running trades or Coffee Arabica.
          try { setContent(normalizeData(injectedSetup)); } catch (_) {}
          try {
            const cc = capitalCheck;
            const el = document.getElementById('capital-banner');
            if (el) {
              if (cc && cc.enough === false) {
                el.textContent = (t.capital_insufficient || "not enough capital to execute today's setup");
                el.style.display = '';
              } else {
                el.style.display = 'none';
              }
            }
          } catch (_) {}
          // UI stays visible even when setup payload is missing.
        }

        function escapeHtml(value) {
          return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        }

        function formatActivityDateTime(iso) {
          if (!iso || typeof iso !== 'string') return '—';
          try {
            const dt = new Date(iso.indexOf('T') === -1 ? (iso.slice(0, 10) + 'T00:00:00Z') : iso);
            if (!dt || isNaN(dt.getTime())) return formatDateDisplay(iso);
            const dateTxt = dt.toISOString().slice(0, 10).replace(/-/g, ' ');
            const hh = String(dt.getUTCHours()).padStart(2, '0');
            const mm = String(dt.getUTCMinutes()).padStart(2, '0');
            return { date: dateTxt, time: hh + ':' + mm + ' UTC' };
          } catch (_) {
            return { date: formatDateDisplay(iso), time: null };
          }
        }

        function buildDateTimeMarkup(dateTxt, timeTxt, wrapperClass) {
          const safeDate = escapeHtml(String(dateTxt || '—'));
          const safeTime = timeTxt ? escapeHtml(String(timeTxt)) : '';
          const cls = wrapperClass || 'activity-item-time';
          return (
            '<span class="' + cls + '">' +
              '<span class="setup-last-check-time">' + safeDate + '</span>' +
              (safeTime
                ? ('<span class="setup-last-check-sep">•</span><span class="setup-last-check-time">' + safeTime + '</span>')
                : '') +
            '</span>'
          );
        }

        function formatActivityEpicDelta(items, prefix) {
          try {
            const epics = Array.isArray(items)
              ? items.map(function (it) { return String(it || '').trim().toUpperCase(); }).filter(Boolean)
              : [];
            if (!epics.length) return '';
            const visible = epics.slice(0, 3).map(function (epic) { return escapeHtml(epic); }).join(', ');
            const extra = Math.max(0, epics.length - 3);
            return prefix + ' ' + visible + (extra ? (' +' + String(extra)) : '');
          } catch (_) {
            return '';
          }
        }

        function renderActivityFeed() {
          try {
            const host = document.getElementById('activity-feed');
            if (!host) return;
            const payload = (injectedPublicActivity && Array.isArray(injectedPublicActivity.items)) ? injectedPublicActivity.items : [];
            if (!payload.length) {
              host.innerHTML = '';
              host.style.display = 'none';
              host.setAttribute('data-has-items', '0');
              return;
            }
            const t = i18n[currentLang] || i18n.en;
            const rows = payload.map(function (it) {
              if (!it || typeof it !== 'object') return '';
              const tsTxt = formatActivityDateTime(it.ts);
              const epic = escapeHtml((it.epic || '').toString().toUpperCase());
              const side = escapeHtml((it.side || '').toString().toLowerCase());
              let title = '';
              let detail = '';
              if (it.type === 'setup_published') {
                title = t.activity_setup_published || 'setup published';
                detail = epic ? (epic + (side ? ' • ' + side : '')) : '';
              } else if (it.type === 'trade_opened') {
                title = t.activity_trade_opened || 'trade opened';
                detail = epic ? (epic + (side ? ' • ' + side : '')) : '';
              } else if (it.type === 'trade_closed') {
                title = t.activity_trade_closed || 'trade closed';
                detail = epic ? (epic + (side ? ' • ' + side : '')) : '';
                const outcomeKey = 'activity_outcome_' + String(it.outcome || 'closed');
                const outcomeLbl = t[outcomeKey] || t.activity_outcome_closed || 'closed';
                if (outcomeLbl) detail = detail ? (detail + ' • ' + escapeHtml(outcomeLbl)) : escapeHtml(outcomeLbl);
              } else if (it.type === 'override_applied') {
                title = t.activity_override_applied || 'strategy update applied';
                detail = epic;
              } else if (it.type === 'override_disabled') {
                title = t.activity_override_disabled || 'strategy update disabled';
                detail = epic;
              } else if (it.type === 'gate_updated') {
                title = t.activity_universe_updated || 'market universe refreshed';
                const enabledCount = Number.isFinite(Number(it.enabled_count)) ? Math.max(0, Number(it.enabled_count)) : 0;
                const parts = [
                  escapeHtml(String(enabledCount)) + ' ' + escapeHtml(t.activity_enabled_epics || 'epics enabled'),
                ];
                const addedTxt = formatActivityEpicDelta(it.enabled_added, '+');
                const removedTxt = formatActivityEpicDelta(it.enabled_removed, '-');
                if (addedTxt) parts.push(addedTxt);
                if (removedTxt) parts.push(removedTxt);
                detail = parts.join(' • ');
              } else if (it.type === 'git_commit') {
                title = t.activity_git_commit || 'latest git commit';
                detail = escapeHtml(String(it.message || '').trim());
              }
              if (!title) return '';
              const timeHtml = (tsTxt && typeof tsTxt === 'object')
                ? buildDateTimeMarkup(tsTxt.date, tsTxt.time, 'activity-item-time')
                : ('<span class="activity-item-time">' + escapeHtml(String(tsTxt || '—')) + '</span>');
              return (
                '<article class="activity-item">' +
                  '<div class="activity-item-head">' +
                    '<span class="activity-item-title">' + escapeHtml(title) + '</span>' +
                    timeHtml +
                  '</div>' +
                  (detail ? ('<div class="activity-item-detail">' + detail + '</div>') : '') +
                '</article>'
              );
            }).filter(Boolean).join('');
            if (!rows) {
              host.innerHTML = '';
              host.style.display = 'none';
              host.setAttribute('data-has-items', '0');
              return;
            }
            host.innerHTML =
              '<h2 class="activity-title">' + escapeHtml(t.activity_title || 'system activity') + '</h2>' +
              '<div class="activity-list">' + rows + '</div>';
            host.setAttribute('data-has-items', '1');
          } catch (_) {}
        }

        function updateActivityFeedVisibility() {
          try {
            const host = document.getElementById('activity-feed');
            if (!host) return false;
            const hasItems = host.getAttribute('data-has-items') === '1';
            const totalVisible = Number(window._visible_running_count || 0) + Number(window._visible_closed_count || 0);
            const shouldShow = !!(hasItems && totalVisible <= 2);
            host.style.display = shouldShow ? '' : 'none';
            return shouldShow;
          } catch (_) {
            return false;
          }
        }

        // Panel visibility control (right column with running/closed)
        function updateRightPanelVisibility() {
          try {
            const boxEl = document.querySelector('.running-box');
            const split = document.querySelector('.split-grid');
            const accRight = document.getElementById('account-bar-right');
            const accOnly = document.getElementById('account-bar-only');
            const rt = document.getElementById('running-title');
            const ct = document.getElementById('closed-title');
            const rl = document.getElementById('running-list');
            const cl = document.getElementById('closed-list');
            const hasAny = (window._has_running === true) || (window._has_closed === true);
            const panelsLoaded = (runningPanelLoaded === true) && (closedPanelLoaded === true);
            const showActivity = updateActivityFeedVisibility();

            // While data is still loading, keep layout stable and do not collapse columns.
            if (!panelsLoaded) {
              if (boxEl) {
                boxEl.style.display = '';
                boxEl.classList.remove('is-reserved-empty');
              }
              if (split) split.classList.remove('no-running');
              if (accRight) accRight.style.display = '';
              if (accOnly) accOnly.style.display = 'none';
              if (rt) rt.style.display = '';
              if (rl) rl.style.display = '';
              if (ct) ct.style.display = 'none';
              if (cl) cl.style.display = 'none';
              return;
            }

            if (hasAny) {
              // Show full panel with lists and bottom account bar
              if (boxEl) {
                boxEl.style.display = '';
                boxEl.classList.remove('is-reserved-empty');
              }
              if (accRight) accRight.style.display = '';
              if (accOnly) accOnly.style.display = 'none';
              if (split) split.classList.remove('no-running');
              // Show running section only if there are currently open trades
              const showRunning = (window._has_running === true);
              if (rt) rt.style.display = showRunning ? '' : 'none';
              if (rl) rl.style.display = showRunning ? '' : 'none';
              // Closed section only if there are closed trades
              if (ct) ct.style.display = (window._has_closed === true ? '' : 'none');
              if (cl) cl.style.display = (window._has_closed === true ? '' : 'none');
            } else {
              // Keep panel footprint reserved to avoid CLS when data becomes available.
              if (boxEl) {
                boxEl.style.display = '';
                if (showActivity) boxEl.classList.remove('is-reserved-empty');
                else boxEl.classList.add('is-reserved-empty');
              }
              if (accRight) accRight.style.display = showActivity ? '' : 'none';
              if (accOnly) accOnly.style.display = showActivity ? 'none' : '';
              if (split) split.classList.remove('no-running');
              if (rt) rt.style.display = 'none';
              if (rl) rl.style.display = 'none';
              if (ct) ct.style.display = 'none';
              if (cl) cl.style.display = 'none';
            }
          } catch (_) {}
        }

        function formatPx(val) {
          if (val === null || val === undefined || val === '') return '—';
          const num = Number(val);
          if (!Number.isFinite(num)) return val;
          const fixed = num.toFixed(4);
          const trimmed = fixed.replace(/\.?0+$/, '');
          return trimmed === '' ? '0' : trimmed;
        }

        function formatDateDisplay(val) {
          if (val === null || val === undefined) return '—';
          let s = String(val);
          if (!s) return '—';
          if (s.indexOf('T') !== -1) s = s.split('T')[0];
          return s.replace(/-/g, ' ');
        }

        function formatUtcHm(iso) {
          if (!iso || typeof iso !== 'string') return null;
          const trimmed = iso.trim();
          if (!trimmed) return null;
          try {
            let dt = null;
            if (trimmed.indexOf('T') === -1 && trimmed.length >= 10) {
              dt = new Date(trimmed.slice(0, 10) + 'T00:00:00Z');
            } else {
              dt = new Date(trimmed);
            }
            if (!dt || isNaN(dt.getTime())) return null;
            const hh = String(dt.getUTCHours()).padStart(2, '0');
            const mm = String(dt.getUTCMinutes()).padStart(2, '0');
            return hh + ':' + mm + ' UTC';
          } catch (_) {
            return null;
          }
        }

        function setupItemIso(it, fallbackIso) {
          if (!it || typeof it !== 'object') return fallbackIso || null;
          return it.executed_at_utc || it.generated_at_utc || fallbackIso || null;
        }

        function setupCheckText(_labelKey, iso) {
          const ts = formatUtcHm(iso);
          if (!ts) return null;
          return ts;
        }

        function isRecentIso(iso, hours) {
          if (!iso) return false;
          const ts = Date.parse(String(iso));
          if (isNaN(ts)) return false;
          const now = Date.now();
          if (ts > now) return false;
          const maxMs = (Number(hours) || 0) * 60 * 60 * 1000;
          return maxMs > 0 && (now - ts) <= maxMs;
        }

        function appendSetupCheckLine(parent, labelKey, iso) {
          if (!parent) return;
          const text = setupCheckText(labelKey, iso);
          if (!text) return;
          const div = document.createElement('div');
          div.className = 'setup-last-check';
          div.textContent = text;
          parent.appendChild(div);
        }

        function appendSetupCheckInline(cardEl, labelKey, iso) {
          if (!cardEl) return false;
          const text = setupCheckText(labelKey, iso);
          if (!text) return false;
          const hdr = cardEl.querySelector('.running-hdr');
          const title = hdr ? hdr.querySelector('.running-title') : null;
          if (!title) return false;
          const span = document.createElement('span');
          span.className = 'setup-last-check setup-last-check-inline setup-last-check-dot-inline';
          span.innerHTML = '<span class="setup-last-check-sep">•</span><span class="setup-last-check-time">' + escapeHtml(text) + '</span>';
          title.appendChild(span);
          return true;
        }

        function appendSetupCard(listEl, cardEl, labelKey, iso) {
          if (!listEl || !cardEl) return;
          const wrap = document.createElement('div');
          wrap.className = 'setup-card-wrap';
          wrap.appendChild(cardEl);
          if (!appendSetupCheckInline(cardEl, labelKey, iso)) {
            appendSetupCheckLine(wrap, labelKey, iso);
          }
          listEl.appendChild(wrap);
          observeMoneyFlashBoxes(cardEl);
        }

        function withNbsp(text) {
          if (text === null || text === undefined) return '';
          let s = escapeHtml(String(text));
          // Treat \" - \" as a non-breaking hyphen segment so labels like
          // \"Oil - Crude\" stay on one line.
          s = s.replace(/ - /g, ' &#8209; ');
          return s.replace(/ /g, '&nbsp;');
        }


        async function loadRunning() {
          try {
            runningPanelLoaded = false;
            const listEl = document.getElementById('running-list');
            const boxEl = document.querySelector('.running-box');
            const split = document.querySelector('.split-grid');
            if (!listEl || !boxEl || !split) return;
            // Do not hide the panel; account summary should always be visible
            listEl.innerHTML = '';
            const all = (injectedRunning && Array.isArray(injectedRunning.items)) ? injectedRunning.items : [];
            // Only show setups that are currently open
            const items = all.filter(function (it) { return it && it.status && it.status.open === true; });

            // Reorder running trades to mirror the visible setup-of-the-day order when available
            const orderedItems = (() => {
              try {
                const orderArr = (typeof window !== 'undefined' && Array.isArray(window._setup_display_order)) ? window._setup_display_order : [];
                if (!orderArr.length) return items;
                const orderMap = new Map();
                orderArr.forEach((k, idx) => { if (!orderMap.has(k)) orderMap.set(k, idx); });
                const keyFor = (it) => {
                  if (!it || !it.instrument) return '';
                  const inst = it.instrument || {};
                  const ep = (inst.epic || '').toString().toUpperCase();
                  const sym = (inst.symbol || '').toString().toUpperCase();
                  return ep || sym || '';
                };
                return items
                  .map((it, idx) => {
                    const k = keyFor(it);
                    const ord = orderMap.has(k) ? orderMap.get(k) : Number.MAX_SAFE_INTEGER;
                    return { it, idx, ord };
                  })
                  .sort((a, b) => {
                    if (a.ord !== b.ord) return a.ord - b.ord;
                    return a.idx - b.idx;
                  })
                  .map((x) => x.it);
              } catch (_) {
                return items;
              }
            })();

            try { window._ordered_running = orderedItems.slice(); } catch (_) {}

            // TradingView widget symbol is selected in setContent with clear priority order.

            // Track and update visibility based on presence
            window._has_running = Array.isArray(orderedItems) && orderedItems.length > 0;
            window._visible_running_count = Array.isArray(orderedItems) ? orderedItems.length : 0;
            if (!window._has_running) {
              try {
                window._expandedRunningCardKey = null;
                window._runningExpandedUserChoice = false;
              } catch (_) {}
              runningPanelLoaded = true;
              updateRightPanelVisibility();
              return;
            }

            const t = i18n[currentLang] || i18n.en;
            if (typeof window._expandedRunningCardKey === 'undefined') window._expandedRunningCardKey = null;
            if (typeof window._runningExpandedUserChoice === 'undefined') window._runningExpandedUserChoice = false;
            const runningCardKeys = orderedItems.map(buildRunningCardKey).filter(Boolean);
            if (window._expandedRunningCardKey && runningCardKeys.indexOf(window._expandedRunningCardKey) === -1) {
              window._expandedRunningCardKey = null;
            }
            // Default expansion: newest running trade (top card), unless user manually chose otherwise.
            if (!window._expandedRunningCardKey && runningCardKeys.length > 0 && window._runningExpandedUserChoice !== true) {
              window._expandedRunningCardKey = runningCardKeys[0];
            }
            orderedItems.forEach(function (it, idx) {
              const inst = it.instrument || {}; const name = inst.name || inst.symbol || '—';
              const symbol = inst.epic || inst.symbol || '—';
              const nameHtml = withNbsp(name);
              const symbolHtml = withNbsp(symbol);
              const date = it.date || '—';
              const dateDisplay = formatDateDisplay(date);
              const side = (it.side || '—').toString().toLowerCase();
              const sideHtml = escapeHtml(side);
              const epicForChart = inst.epic || inst.symbol || symbol || '';
              const cardKey = buildRunningCardKey(it);
              const isExpanded = (window._expandedRunningCardKey === cardKey);
              const chartContainerId = 'running_tv_' + idx + '_' + cardKey.replace(/[^a-zA-Z0-9_]+/g, '_');
              let titleHtml = escapeHtml(dateDisplay);
              try {
                const timeIso = it.entry_time_utc || it.executed_at_utc || (it.raw && it.raw.entry_time_utc) || null;
                const timeTxt = formatUtcHm(timeIso);
                if (timeTxt) {
                  titleHtml = buildDateTimeMarkup(dateDisplay, timeTxt, 'setup-last-check setup-last-check-inline setup-last-check-dot-inline setup-last-check-card-inline');
                }
              } catch (_) {}
              const entryDisplay = formatPx(it.entry);
              let stopDisplay = formatPx(it.stop);
              const initialStopNum = (() => {
                try {
                  if (typeof it.initial_stop === 'number') return it.initial_stop;
                  if (it.initial_stop !== null && it.initial_stop !== undefined) {
                    const parsed = Number(it.initial_stop);
                    return Number.isFinite(parsed) ? parsed : null;
                  }
                } catch (_) {}
                return null;
              })();
              const stopLabelDefault = (t.label_stop || 'stop');
              let stopLabel = stopLabelDefault;
              const st = it.status || {};
              var stoppedOut = (st && (st.stopped_out === true || st.stopped_out_local === true));
              let pillParts = [];
              if (st.exit_due === true && !stoppedOut) {
                try {
                  const now = new Date();
                  const dow = now.getDay(); // 0=Sun,6=Sat (local time)
                  const isWeekend = (dow === 0 || dow === 6);
                  const skip = (it && it.skip_weekends === true);
                  const useNext = Boolean(isWeekend && skip);
                  if (useNext) {
                    const next = new Date(now);
                    if (dow === 6) { next.setDate(next.getDate() + 2); } // Sat -> Mon
                    else if (dow === 0) { next.setDate(next.getDate() + 1); } // Sun -> Mon
                    const langTag = (currentLang === 'de') ? 'de-DE' : 'en-US';
                    let dayName = next.toLocaleDateString(langTag, { weekday: 'long' });
                    if (currentLang !== 'de') { try { dayName = (dayName || '').toLowerCase(); } catch (_) {} }
                    const prefix = (i18n[currentLang] && i18n[currentLang].running_exit_prefix) ? i18n[currentLang].running_exit_prefix : (currentLang === 'de' ? 'Ausstieg' : 'exit');
                    const lbl = prefix + ' ' + dayName;
                    pillParts.push('<span class="status-pill status-exit" title="' + lbl + '" aria-label="' + lbl + '">' + lbl + '</span>');
                  } else {
                    const tip = (t.running_exit_today_tip || 'exit today');
                    const lbl = (t.running_exit_today || 'exit today');
                    pillParts.push('<span class="status-pill status-exit" title="' + tip + '" aria-label="' + tip + '">' + lbl + '</span>');
                  }
                } catch (_) {
                  pillParts.push('<span class="status-pill status-exit" title="' + (t.running_exit_today_tip || 'exit today') + '" aria-label="' + (t.running_exit_today_tip || 'exit today') + '">' + (t.running_exit_today || 'exit today') + '</span>');
                }
              }
              // Only show "open" pill if not stopped out
              if (!stoppedOut) {
                pillParts.push('<span class="status-pill status-open" title="' + (t.running_open_tip || 'open') + '" aria-label="' + (t.running_open_tip || 'open') + '">' + (t.running_open || 'open') + '</span>');
              }
              // Guaranteed stop badge with tooltip
              if (it.gslo === true) {
                var tt = (t.gslo_tip || 'Guaranteed stop');
                var lbl = (t.gslo_badge || 'GSLO');
                pillParts.push('<span class="status-pill status-gslo" title="' + tt + '" aria-label="' + tt + '">' + lbl + '</span>');
              }
              // Local stop-out indicator (no ledger changes here)
              if (stoppedOut) {
                var lblStopped = (t.running_stopped || (currentLang === 'de' ? 'ausgestoppt' : 'stopped out'));
                var tipStopped = (t.running_stopped_tip || lblStopped);
                pillParts.push('<span class="status-pill status-stopped" title="' + tipStopped + '" aria-label="' + tipStopped + '">' + lblStopped + '</span>');
              }
              try {
                if (st.trailing && st.trailing.enabled && st.trailing.reposition && !stoppedOut) {
                  var tip = (t.running_update_stop_tip || 'new trailing stop suggested');
                  if (typeof st.trailing.suggested_stop === 'number') { tip += ': ' + formatPx(st.trailing.suggested_stop); }
                  pillParts.push('<span class="status-pill status-trail" title="' + tip + '" aria-label="' + tip + '">' + (t.running_update_stop || 'update stop') + '</span>');
              }
              } catch (_) {}
              const pill = pillParts.length ? (' ' + pillParts.join(' ')) : '';
            // Inline return (next to instrument): show instrument price change since entry (not PnL)
            const retInline = computeRunningRetInlineHtml(it, side);
            // Profit for running trades: show as fraction of configured risk (FX/multiplier invariant)
            const profitValueHtml = computeRunningProfitValueHtml(it, side, t);
            let trailMeta = '';
            try {
              const trailingStopNum = (st && st.trailing && typeof st.trailing.suggested_stop === 'number') ? st.trailing.suggested_stop : null;
              const hasTrailing = Boolean(st && st.trailing && st.trailing.enabled && typeof st.trailing.suggested_stop === 'number');
              const trailingMatchesInitial = Boolean(
                hasTrailing &&
                trailingStopNum !== null &&
                initialStopNum !== null &&
                Math.abs(trailingStopNum - initialStopNum) < 1e-9
              );
              if (hasTrailing && !trailingMatchesInitial && trailingStopNum !== null) {
                const trailingLabel = (t.label_trailing_stop || 'trailing&nbsp;stop');
                trailMeta = ' • ' + trailingLabel + ':&nbsp;' + formatPx(trailingStopNum);
                stopLabel = (t.label_initial_stop || 'initial&nbsp;stop');
                // When trailing is active, show the true initial stop if available
                try {
                  if (initialStopNum !== null) {
                    stopDisplay = formatPx(initialStopNum);
                  }
                } catch (_) {}
              }
            } catch (_) {}
            const div = document.createElement('div');
            div.className = 'running-card running-trade-card money-flash-box' + (isExpanded ? ' is-expanded' : '');
            if (cardKey) div.setAttribute('data-running-card-key', cardKey);
            // Append size and risk to the same details row (inline, with separators)
            let rs = '';
            let sizeSuffix = '';
            let riskSuffix = '';
              try {
                const sz = (typeof it.size === 'number') ? it.size : null;
                const rpStored = (typeof it.risk_pct === 'number' && Number.isFinite(it.risk_pct)) ? it.risk_pct : null;
                const rpInitial = (typeof it.risk_pct_initial === 'number' && Number.isFinite(it.risk_pct_initial)) ? it.risk_pct_initial : null;
              const rp = (rpInitial !== null) ? rpInitial : (rpStored !== null ? rpStored : null);
              if (sz != null || rp != null) {
                const lblSize = (t.label_size || 'size');
                const lblRisk = (t.label_risk || 'risk');
                if (sz != null) sizeSuffix = ' • ' + lblSize + ':&nbsp;' + sz.toFixed(4);
                if (rp != null) riskSuffix = ' • ' + lblRisk + ':&nbsp;' + (rp * 100).toFixed(2) + '%';
              }
            } catch (_) {}
            var pillWrap = pill ? ('<div class="pill-wrap">' + pill + '</div>') : '';
            var getExpandLabel = function (expanded) {
              return expanded
                ? (currentLang === 'de' ? 'chart ausblenden' : 'close chart')
                : (currentLang === 'de' ? 'chart anzeigen' : 'show chart');
            };
            var expandLbl = getExpandLabel(isExpanded);
            var expandLblHtml = escapeHtml(expandLbl);
            var expandBtn = '<button type="button" class="running-expand-btn" aria-expanded="' + (isExpanded ? 'true' : 'false') + '" aria-label="' + expandLblHtml + '" title="' + expandLblHtml + '"><span class="sr-only running-expand-label">' + expandLblHtml + '</span><svg class="running-expand-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>';
            var topChartLbl = (t.running_main_chart_tip || (currentLang === 'de' ? 'dieses Instrument im oberen Chart anzeigen' : 'show this instrument in top chart'));
            var topChartLblHtml = escapeHtml(topChartLbl);
            var topChartBtn = '<button type="button" class="running-main-chart-btn" aria-label="' + topChartLblHtml + '" title="' + topChartLblHtml + '"><svg class="running-main-chart-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16v16H4z"/><path d="M7 14l3-3 2 2 5-5"/></svg></button>';
            var rightControls = pillWrap ? ('<div class="running-hdr-controls">' + pillWrap + '</div>') : '';
            var chartHtml = '<div class="running-chart-wrap"><div id="' + chartContainerId + '" class="running-tv-chart"></div></div>';
            var profitLine = '<div class="running-meta return-line"><span class="return-left">' + expandBtn + topChartBtn + '</span><span class="return-right"><span class="running-profit-inline">' + (profitValueHtml || '') + '</span></span></div>';
            div.innerHTML = (
                '<div class="running-hdr">'
                + '<p class="running-title">' + titleHtml + '</p>'
                + rightControls
                + '</div>'
                + '<div class="running-meta">'
                  + '<span class="nocaps inst-strong">' + nameHtml + '</span>' + ' (' + '<span class="nocaps">' + symbolHtml + '</span>' + ')' + '<span class="running-ret-inline">' + (retInline || '') + '</span>'
                + '</div>'
                + '<div class="running-meta">' + '<span class="side-strong">' + sideHtml + '</span>' + ' • ' + escapeHtml(t.label_entry || 'entry') + ':&nbsp;' + entryDisplay + ' • ' + escapeHtml(stopLabel) + ':&nbsp;' + stopDisplay + trailMeta + (sizeSuffix || '') + (riskSuffix || '') + '</div>'
                + profitLine
                + chartHtml
              );
              listEl.appendChild(div);
              observeMoneyFlashBoxes(div);
              var ensureInlineChartLoaded = function () {
                try {
                  var chartEl = document.getElementById(chartContainerId);
                  if (!chartEl) return;
                  if (chartEl.getAttribute('data-tv-loaded') === '1') return;
                  chartEl.setAttribute('data-tv-loaded', '1');
                  tvReady(function () { createInlineRunningTVWidget(chartContainerId, epicForChart); });
                } catch (_) {}
              };
              var topChartBtnEl = div.querySelector('.running-main-chart-btn');
              if (topChartBtnEl) {
                topChartBtnEl.addEventListener('click', function (ev) {
                  try {
                    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
                  } catch (_) {}
                  var topSymbol = toCapitalTvSymbol(epicForChart);
                  if (!topSymbol) return;
                  window._dax_tv_manual_symbol = topSymbol;
                  setTopTVSymbol(topSymbol, { forceLoad: true });
                  try {
                    var chartTarget = document.getElementById('tradingview_chart') || document.querySelector('.chart-box') || document.getElementById('setup');
                    if (chartTarget && chartTarget.scrollIntoView) {
                      chartTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  } catch (_) {}
                });
              }
              div.addEventListener('click', function (ev) {
                try {
                  if (ev && ev.target && ev.target.closest && ev.target.closest('.running-chart-wrap')) return;
                } catch (_) {}
                var nextExpanded = true;
                try { nextExpanded = !div.classList.contains('is-expanded'); } catch (_) {}
                try {
                  listEl.querySelectorAll('.running-trade-card.is-expanded').forEach(function (other) {
                    if (other === div) return;
                    other.classList.remove('is-expanded');
                    var ob = other.querySelector('.running-expand-btn');
                    if (ob) {
                      var obLabel = getExpandLabel(false);
                      ob.setAttribute('aria-expanded', 'false');
                      ob.setAttribute('aria-label', obLabel);
                      ob.setAttribute('title', obLabel);
                      var obText = ob.querySelector('.running-expand-label');
                      if (obText) obText.textContent = obLabel;
                    }
                  });
                } catch (_) {}
                if (nextExpanded) {
                  div.classList.add('is-expanded');
                  window._expandedRunningCardKey = cardKey;
                  ensureInlineChartLoaded();
                } else {
                  div.classList.remove('is-expanded');
                  window._expandedRunningCardKey = null;
                }
                window._runningExpandedUserChoice = true;
                try {
                  var eb = div.querySelector('.running-expand-btn');
                  if (eb) {
                    var ebLabel = getExpandLabel(nextExpanded);
                    eb.setAttribute('aria-expanded', nextExpanded ? 'true' : 'false');
                    eb.setAttribute('aria-label', ebLabel);
                    eb.setAttribute('title', ebLabel);
                    var ebText = eb.querySelector('.running-expand-label');
                    if (ebText) ebText.textContent = ebLabel;
                  }
                } catch (_) {}
              });
              if (isExpanded) ensureInlineChartLoaded();
            });
            runningPanelLoaded = true;
            updateRightPanelVisibility();
          } catch (e) {
            // keep hidden on error
            window._has_running = false;
            window._visible_running_count = 0;
            runningPanelLoaded = true;
            updateRightPanelVisibility();
          }
        }

        async function loadClosed() {
          try {
            closedPanelLoaded = false;
            const listEl = document.getElementById('closed-list');
            const boxEl = document.querySelector('.running-box');
            if (!listEl || !boxEl) return;
            listEl.innerHTML = '';
            const items = (injectedClosed && Array.isArray(injectedClosed.items)) ? injectedClosed.items : [];
            window._has_closed = items.length > 0;
            window._visible_closed_count = items.length;
            if (!window._has_closed) {
              closedPanelLoaded = true;
              updateRightPanelVisibility();
              return;
            }
            const t = i18n[currentLang] || i18n.en;
            items.forEach(function (it) {
              if (!it || typeof it !== 'object') return;
              const inst = it.instrument || {};
              const name = inst.name || inst.symbol || inst.epic || it.epic || '—';
              const symbol = inst.epic || it.epic || inst.symbol || '—';
              const nameHtml = withNbsp(name);
              const symbolHtml = withNbsp(symbol);
              const side = (it.side || '—').toString().toLowerCase();
              const sideHtml = escapeHtml(side);
              const entryRaw = (it.entry != null ? it.entry : it.entry_price_est);
              const closeRaw = (it.close != null ? it.close : it.close_price_est);
              const entryDisplay = formatPx(entryRaw);
              const closeDisplay = formatPx(closeRaw);
              let entryNum = null;
              if (typeof entryRaw === 'number') {
                entryNum = entryRaw;
              } else if (entryRaw !== null && entryRaw !== undefined) {
                const parsedEntry = Number(entryRaw);
                if (Number.isFinite(parsedEntry)) entryNum = parsedEntry;
              }
              let closeNum = null;
              if (typeof closeRaw === 'number') {
                closeNum = closeRaw;
              } else if (closeRaw !== null && closeRaw !== undefined) {
                const parsedClose = Number(closeRaw);
                if (Number.isFinite(parsedClose)) closeNum = parsedClose;
              }
              const qty = (typeof it.qty === 'number') ? it.qty : (typeof it.size === 'number' ? it.size : null);
              const date = (it.closed_at_utc ? String(it.closed_at_utc).split('T')[0] : (it.date || '—'));
              const dateDisplay = formatDateDisplay(date);
              const closedIso = (it.closed_at_utc ? String(it.closed_at_utc) : null);
              let titleHtml = escapeHtml(dateDisplay);
              try {
                const timeTxt = formatUtcHm(closedIso);
                if (timeTxt) {
                  titleHtml = buildDateTimeMarkup(dateDisplay, timeTxt, 'setup-last-check setup-last-check-inline setup-last-check-dot-inline setup-last-check-card-inline');
                }
              } catch (_) {}
              const reason = (String(it.reason || '')).toLowerCase();
              // compute price change pct (instrument move), independent of side
              let chgPct = null;
              try { if (entryNum != null && closeNum != null && entryNum > 0) { chgPct = ((closeNum - entryNum) / entryNum) * 100.0; } } catch (_) {}
              // Reason-specific pill: stopped-out gets dedicated label
              let isStoppedForPill = (reason === 'stopped' || reason === 'strategy_stop');
              try {
                if (!isStoppedForPill && it.stopped_out === true) isStoppedForPill = true;
                if (!isStoppedForPill && (reason === 'broker_closed' || reason === 'broker_closed_unknown')) {
                  const p = (typeof it.pnl_pct_equity === 'number' && Number.isFinite(it.pnl_pct_equity)) ? it.pnl_pct_equity : null;
                  if (p != null && p < 0) isStoppedForPill = true;
                }
              } catch (_) {}
              let pill = '';
              if (isStoppedForPill) {
                var lblStopped = (t.running_stopped || (currentLang === 'de' ? 'ausgestoppt' : 'stopped out'));
                var tipStopped = (t.running_stopped_tip || lblStopped);
                pill = '<span class="status-pill status-stopped" title="' + tipStopped + '" aria-label="' + tipStopped + '">' + lblStopped + '</span>';
              } else {
                var closedLbl = (t.running_closed || (currentLang === 'de' ? 'geschlossen' : 'closed'));
                pill = '<span class="status-pill status-closed" title="' + closedLbl + '" aria-label="' + closedLbl + '">' + closedLbl + '</span>';
              }
              let sizeSuffix = '';
              try { if (qty != null) { const lblSize = (t.label_size || 'size'); sizeSuffix = ' • ' + lblSize + ':&nbsp;' + Number(qty).toFixed(4); } } catch (_) {}
              // Build inline return suffix appended to the instrument line (no label): price change
              let profitInline = '';
              if (typeof chgPct === 'number') {
                let tri = '';
                let sgn = '';
                let cls = '';
                if (chgPct > 0) { tri = '▲&nbsp;'; sgn = '+'; cls = 'return-pos'; }
                else if (chgPct < 0) { tri = '▼&nbsp;'; sgn = '-'; cls = 'return-neg'; }
                else {
                  // Exactly 0.0% → color by side: green for long, red for short
                  if (side === 'long') { tri = '▲&nbsp;'; cls = 'return-pos'; }
                  else if (side === 'short') { tri = '▼&nbsp;'; cls = 'return-neg'; }
                }
                const pct = Math.abs(chgPct).toFixed(1) + '\u00A0%';
                const valueHtml = cls ? ('<span class="' + cls + '">' + tri + sgn + pct + '</span>') : (tri + sgn + pct);
                profitInline = '&nbsp;' + valueHtml;
              }
              // Separate profit line: compute realized PnL in account currency when available
              let profitLine = '';
              try {
                const pnlPctR = (typeof it.pnl_pct_r === 'number' && Number.isFinite(it.pnl_pct_r)) ? it.pnl_pct_r : null;
                const pnlPctEquity = (typeof it.pnl_pct_equity === 'number' && Number.isFinite(it.pnl_pct_equity)) ? it.pnl_pct_equity : null;
                const profitPct = (pnlPctR != null) ? pnlPctR : pnlPctEquity;
                if (profitPct != null && Number.isFinite(profitPct)) {
                  const s2 = profitPct > 0 ? '+' : (profitPct < 0 ? '-' : '');
                  const c2 = profitPct > 0 ? 'return-pos' : (profitPct < 0 ? 'return-neg' : '');
                  const p2 = Math.abs(profitPct).toFixed(1) + '\u00A0%';
                  // Do not show triangle next to profit label
                  const v2 = c2 ? ('<span class="' + c2 + '">' + s2 + p2 + '</span>') : (s2 + p2);
                  profitLine = '<div class="running-meta return-line"><span class="return-right">' + (t.label_pnl || 'profit') + ':&nbsp;' + v2 + '</span></div>';
                }
              } catch (_) {}
              const div = document.createElement('div');
              div.className = 'running-card money-flash-box';
              var pillWrap = pill ? ('<div class="pill-wrap">' + pill + '</div>') : '';
              div.innerHTML = (
                '<div class="running-hdr">'
                + '<p class="running-title">' + titleHtml + '</p>'
                + pillWrap
                + '</div>'
                  + '<div class="running-meta">'
                  + '<span class="nocaps inst-strong">' + nameHtml + '</span>' + ' (' + '<span class="nocaps">' + symbolHtml + '</span>' + ')' + (profitInline || '')
                + '</div>'
                + '<div class="running-meta">' + '<span class="side-strong">' + sideHtml + '</span>' + ' • ' + escapeHtml(t.label_entry || 'entry') + ':&nbsp;' + entryDisplay + ' • ' + escapeHtml(t.label_close || 'close') + ':&nbsp;' + closeDisplay + (sizeSuffix || '') + '</div>'
                + (profitLine || '')
              );
              listEl.appendChild(div);
              observeMoneyFlashBoxes(div);
            });
            closedPanelLoaded = true;
            updateRightPanelVisibility();
          } catch (e) {
            // ignore errors silently
            window._has_closed = false;
            window._visible_closed_count = 0;
            closedPanelLoaded = true;
            updateRightPanelVisibility();
          }
        }

        function initThemeToggle() {
          const btn = document.getElementById('theme-toggle');
          const langBtn = document.getElementById('lang-toggle');
          if (!btn) return;
          syncThemeToSystem();
          setToggleIcon(resolveTheme());
          try {
            const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
            if (media && typeof media.addEventListener === 'function') {
              media.addEventListener('change', syncThemeToSystem);
            } else if (media && typeof media.addListener === 'function') {
              media.addListener(syncThemeToSystem);
            }
          } catch (_) {}
          btn.addEventListener('click', function () {
            if (isMobile()) {
              syncThemeToSystem();
              return;
            }
            const current = resolveTheme();
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.dataset.theme = next;
            try { localStorage.setItem('theme', next); } catch (_) {}
            try { document.cookie = 'theme=' + next + '; max-age=31536000; path=/'; } catch (_) {}
            setToggleIcon(next);
            if (window._dax_tv_symbol && (topChartLoadRequested || window._dax_top_tv_widget)) {
              setTopTVSymbol(window._dax_tv_symbol, { forceLoad: true });
            }
            try { loadRunning(); } catch (_) {}
          });
          // Show bulb/menu only at top of page
          function updateBulb() {
            try {
              if (window.scrollY > 0) {
                btn.classList.add('hidden');
                if (langBtn) langBtn.classList.add('hidden');
              } else {
                btn.classList.remove('hidden');
                if (langBtn) langBtn.classList.remove('hidden');
              }
            } catch (_) {}
            try {
              var menu = document.querySelector('.top-nav');
              if (menu) {
                if (window.scrollY > 0) { menu.classList.add('hidden'); }
                else { menu.classList.remove('hidden'); }
              }
            } catch (_) {}
          }
          updateBulb();
          window.addEventListener('scroll', updateBulb, { passive: true });
        }

        function initBackgroundParallax() {
          if (isMobile && isMobile()) return;
          var root = document.documentElement;
          var grid = document.querySelector('.bg-grid');
          var candles = document.querySelector('.bg-candles');
          if (!root || !grid || !candles) return;
          var style = root.style;
          var lastY = window.scrollY || window.pageYOffset || 0;
          var slow = 0;
          var fast = 0;
          var raf = null;
          var slowFactor = 0.08;
          var fastFactor = 0.18;
          var limit = 1600;
          function wrap(val) {
            if (val > limit) return val - (limit * 2);
            if (val < -limit) return val + (limit * 2);
            return val;
          }
          function apply() {
            raf = null;
            slow = wrap(slow);
            fast = wrap(fast);
            style.setProperty('--bg-shift-slow', slow.toFixed(2) + 'px');
            style.setProperty('--bg-shift-fast', fast.toFixed(2) + 'px');
          }
          function onScroll() {
            var currentY = window.scrollY || window.pageYOffset || 0;
            var delta = currentY - lastY;
            lastY = currentY;
            slow += delta * -slowFactor;
            fast += delta * fastFactor;
            if (!raf) {
              raf = requestAnimationFrame(apply);
            }
          }
          window.addEventListener('scroll', onScroll, { passive: true });
          onScroll();
        }

        function markStartOverlayDone() {
          try {
            if (window._dax_start_overlay_done === true) return;
            window._dax_start_overlay_done = true;
            window.dispatchEvent(new Event('dax:start-overlay-done'));
          } catch (_) {}
        }

        function onStartOverlayDone(fn) {
          if (typeof fn !== 'function') return;
          try {
            if (window._dax_start_overlay_done === true) {
              fn();
              return;
            }
          } catch (_) {}
          window.addEventListener('dax:start-overlay-done', function () {
            try { fn(); } catch (_) {}
          }, { once: true });
        }

        function initStartOverlay() {
          const overlay = document.querySelector('.start-overlay');
          const navLogoSlot = document.querySelector('.nav-logo-slot');
          const navSetupLink = document.getElementById('nav-setup');
          if (!overlay) {
            try { if (navLogoSlot) navLogoSlot.classList.add('is-visible'); } catch (_) {}
            markStartOverlayDone();
            return;
          }
          const flight = overlay.querySelector('.start-logo-flight');
          const logo = overlay.querySelector('.start-logo-gold') || overlay.querySelector('.start-logo');
          let done = false;
          const motionDelayMs = 180;
          const motionDurationMs = 760;
          const fadeDurationMs = 180;
          const staticHoldMs = 260;
          const shouldAnimateToNav = (function () {
            try {
              return (window.scrollY || window.pageYOffset || 0) <= 2;
            } catch (_) {
              return true;
            }
          })();

          function revealNavLogo() {
            try { if (navLogoSlot) navLogoSlot.classList.add('is-visible'); } catch (_) {}
          }

          function waitForNavTargetReady(cb) {
            if (typeof cb !== 'function') return;
            if (!shouldAnimateToNav || !navSetupLink || !navLogoSlot) {
              cb();
              return;
            }

            let finished = false;
            function done() {
              if (finished) return;
              finished = true;
              cb();
            }

            let lastSignature = '';
            let stableFrames = 0;
            const startedAt = Date.now();

            function signature() {
              try {
                const setupRect = navSetupLink.getBoundingClientRect();
                const slotRect = navLogoSlot.getBoundingClientRect();
                return [
                  Math.round(setupRect.left * 10),
                  Math.round(setupRect.width * 10),
                  Math.round(slotRect.left * 10),
                  Math.round(slotRect.width * 10),
                ].join(':');
              } catch (_) {
                return '';
              }
            }

            function poll() {
              if (finished) return;
              const sig = signature();
              if (sig && sig === lastSignature) {
                stableFrames += 1;
              } else {
                stableFrames = 0;
                lastSignature = sig;
              }
              if (stableFrames >= 2 || Date.now() - startedAt > 900) {
                done();
                return;
              }
              window.requestAnimationFrame(poll);
            }

            try {
              if (document.fonts && document.fonts.load) {
                Promise.allSettled([
                  document.fonts.load('600 1rem "IBM Plex Mono"'),
                  document.fonts.ready,
                ]).finally(function () {
                  window.requestAnimationFrame(poll);
                });
                return;
              }
            } catch (_) {}
            window.requestAnimationFrame(poll);
          }

          function hideOverlay() {
            if (done) return;
            done = true;
            try { overlay.classList.remove('is-active', 'is-transitioning', 'is-hiding'); } catch (_) {}
            try { overlay.style.display = 'none'; } catch (_) {}
            revealNavLogo();
            markStartOverlayDone();
          }

          function finish(skipAnimation) {
            if (done) return;
            if (skipAnimation) {
              revealNavLogo();
              hideOverlay();
              return;
            }
            if (!shouldAnimateToNav) {
              setTimeout(function () {
                if (done) return;
                revealNavLogo();
                hideOverlay();
              }, staticHoldMs);
              return;
            }
            if (!flight || !navLogoSlot) {
              revealNavLogo();
              hideOverlay();
              return;
            }
            let sourceRect = null;
            let targetRect = null;
            let setupRect = null;
            try {
              sourceRect = flight.getBoundingClientRect();
              targetRect = navLogoSlot.getBoundingClientRect();
              if (navSetupLink) setupRect = navSetupLink.getBoundingClientRect();
            } catch (_) {}
            if (!sourceRect || !targetRect || !(sourceRect.width > 0) || !(targetRect.width > 0)) {
              hideOverlay();
              return;
            }

            const sourceCx = sourceRect.left + sourceRect.width / 2;
            const sourceCy = sourceRect.top + sourceRect.height / 2;
            let targetCx = targetRect.left + targetRect.width / 2;
            const targetCy = targetRect.top + targetRect.height / 2;
            if (setupRect && setupRect.width > 0) {
              let gapPx = 16;
              try {
                const topNav = document.querySelector('.top-nav');
                if (topNav) {
                  const cs = window.getComputedStyle(topNav);
                  const parsed = parseFloat(cs.columnGap || cs.gap || '');
                  if (Number.isFinite(parsed) && parsed >= 0) gapPx = parsed;
                }
              } catch (_) {}
              targetCx = setupRect.left - gapPx - (targetRect.width / 2);
            }
            const dx = targetCx - sourceCx;
            const dy = targetCy - sourceCy;
            const scale = targetRect.width / sourceRect.width;

            try {
              flight.style.setProperty('--start-target-x', dx.toFixed(2) + 'px');
              flight.style.setProperty('--start-target-y', dy.toFixed(2) + 'px');
              flight.style.setProperty('--start-target-scale', String(scale));
              overlay.classList.add('is-transitioning');
              void flight.offsetWidth;
              setTimeout(function () {
                try { flight.classList.add('is-moving'); } catch (_) {}
              }, motionDelayMs);
              setTimeout(function () {
                revealNavLogo();
                try { overlay.classList.add('is-hiding'); } catch (_) {}
              }, motionDelayMs + motionDurationMs);
              setTimeout(hideOverlay, motionDelayMs + motionDurationMs + fadeDurationMs);
            } catch (_) {
              hideOverlay();
            }
          }

          const reduceMotion = (function () {
            try {
              return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
            } catch (_) { return false; }
          })();
          const maxWaitMs = 700;
          const timeoutId = setTimeout(function () {
            // If logo isn't ready quickly, skip startup animation entirely.
            finish(true);
          }, maxWaitMs);

          const onLogoReady = function () {
            clearTimeout(timeoutId);
            waitForNavTargetReady(function () {
              finish(reduceMotion);
            });
          };
          const onLogoError = function () {
            clearTimeout(timeoutId);
            finish(true);
          };

          if (!logo) {
            clearTimeout(timeoutId);
            finish(true);
            return;
          }
          try {
            if (logo.complete && Number(logo.naturalWidth || 0) > 0) {
              onLogoReady();
              return;
            }
          } catch (_) {}
          logo.addEventListener('load', onLogoReady, { once: true });
          logo.addEventListener('error', onLogoError, { once: true });
        }

        function initLanguage() {
          const savedLS = (function () { try { return localStorage.getItem('lang'); } catch (_) { return null; } })();
          const savedCK = (function () { try { return getCookie('lang'); } catch (_) { return null; } })();
          const nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
          const pref = (savedLS === 'en' || savedLS === 'de') ? savedLS : ((savedCK === 'en' || savedCK === 'de') ? savedCK : null);
          const initial = pref || (nav.startsWith('de') ? 'de' : 'en');
          applyLang(initial);

          const btn = document.getElementById('lang-toggle');
          if (!btn) return;
          btn.addEventListener('click', function () {
            const lang = currentLang === 'de' ? 'en' : 'de';
            applyLang(lang);
            try { localStorage.setItem('lang', lang); } catch (_) {}
            try { document.cookie = 'lang=' + lang + '; max-age=31536000; path=/'; } catch (_) {}
            if (window._dax_last_data) setContent(window._dax_last_data);
            try { renderActivityFeed(); } catch (_) {}
            try { loadRunning(); } catch (_) {}
            try { loadClosed(); } catch (_) {}
          });
        }

        // ——— Impressum modal
        function getCookie(name) {
          const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
          return v ? v.pop() : '';
        }

        function fetchFormTokens() {
          return fetch('/form-tokens/', {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            headers: { 'Accept': 'application/json' }
          }).then(async function (r) {
            if (!r.ok) return null;
            let data = null;
            try { data = await r.json(); } catch (_) { data = null; }
            if (!data || typeof data !== 'object') return null;
            return data;
          }).catch(function () {
            return null;
          });
        }

        function renderImpressum(lang) {
          const wrap = document.querySelector('.impressum-content');
          if (!wrap) return;
          const html = (lang === 'de') ? IMPRESSUM_HTML.de : IMPRESSUM_HTML.en;
          try { wrap.innerHTML = html; } catch (_) {}
        }

        function renderLicenses(lang) {
          const wrap = document.querySelector('.licenses-content');
          if (!wrap) return;
          const html = (lang === 'de') ? LICENSES_HTML.de : LICENSES_HTML.en;
          try { wrap.innerHTML = html; } catch (_) {}
        }

        function bindImpressumForm() {
          var form = document.getElementById('impressum-contact-form');
          var statusEl = document.getElementById('imp-status');
          var submitBtn = document.getElementById('imp-submit');
          if (!form) return;
          const t = i18n[currentLang] || i18n.en;
          // Remove previous handler if any by cloning
          const newForm = form.cloneNode(true);
          form.parentNode.replaceChild(newForm, form);
          form = newForm;
          statusEl = document.getElementById('imp-status');
          submitBtn = document.getElementById('imp-submit');

          // Preload time-trap tokens into hidden fields
          try {
            var tsMeta = document.querySelector('meta[name="contact-ts"]');
            var sigMeta = document.querySelector('meta[name="contact-sig"]');
            if (tsMeta) { var tsEl = document.getElementById('imp-ts'); if (tsEl) tsEl.value = tsMeta.getAttribute('content') || ''; }
            if (sigMeta) { var tokEl = document.getElementById('imp-ttoken'); if (tokEl) tokEl.value = sigMeta.getAttribute('content') || ''; }
          } catch (_) {}

          form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (!submitBtn) return;
            const payload = {
              name: (document.getElementById('imp-name') || {}).value || '',
              email: (document.getElementById('imp-email') || {}).value || '',
              message: (document.getElementById('imp-message') || {}).value || '',
              homepage: (document.getElementById('imp-homepage') || {}).value || '',
              ts: (document.getElementById('imp-ts') || {}).value || '',
              ttoken: (document.getElementById('imp-ttoken') || {}).value || ''
            };
            submitBtn.disabled = true;
            if (statusEl) { statusEl.textContent = t.imp_sending; }
            fetchFormTokens().then(function (tok) {
              try {
                if (tok && tok.contact) {
                  payload.ts = tok.contact.ts || payload.ts;
                  payload.ttoken = tok.contact.ttoken || payload.ttoken;
                  var tsEl = document.getElementById('imp-ts');
                  var tokEl = document.getElementById('imp-ttoken');
                  if (tsEl) tsEl.value = String(payload.ts || '');
                  if (tokEl) tokEl.value = String(payload.ttoken || '');
                }
              } catch (_) {}
              return fetch('/contact/', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                  'Content-Type': 'application/json',
                  'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify(payload)
              });
            }).then(async (r) => {
              let data = {};
              try { data = await r.json(); } catch (_) {}
              if (r.ok && data && data.ok) {
                if (statusEl) statusEl.textContent = t.imp_sent;
                try { (document.getElementById('imp-message') || {}).value = ''; (document.getElementById('imp-name') || {}).value = ''; (document.getElementById('imp-email') || {}).value = ''; } catch (_) {}
              } else {
                const errs = (data && data.errors) || {};
                let msg = '';
                if (errs.name) msg = t.imp_err_name;
                else if (errs.email) msg = t.imp_err_email;
                else if (errs.message) msg = t.imp_err_message;
                else msg = t.imp_error;
                if (statusEl) statusEl.textContent = msg;
              }
            }).catch(() => {
              if (statusEl) statusEl.textContent = t.imp_network;
            }).finally(() => {
              submitBtn.disabled = false;
            });
          });
        }

        function initImpressum() {
          var link = document.getElementById('impressum-link');
          var modal = document.getElementById('impressum-modal');
          if (!link || !modal) return;
          var card = modal.querySelector('.impressum-card');
          var closeBtn = modal.querySelector('.impressum-close');

          function openModal() {
            modal.style.display = 'grid';
            try { card && card.focus(); } catch (_) {}
          }
          function closeModal() {
            modal.style.display = 'none';
            try { link && link.focus(); } catch (_) {}
          }

          link.addEventListener('click', function (e) { e.preventDefault(); openModal(); });
          modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
          if (closeBtn) closeBtn.addEventListener('click', closeModal);
          document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.style.display !== 'none') closeModal(); });

          // Bind form for current language
          bindImpressumForm();
        }

        function initLicenses() {
          var link = document.getElementById('licenses-link');
          var modal = document.getElementById('licenses-modal');
          if (!link || !modal) return;
          var card = modal.querySelector('.licenses-card');
          var closeBtn = modal.querySelector('.licenses-close');

          function openModal() {
            modal.style.display = 'grid';
            try { card && card.focus(); } catch (_) {}
          }
          function closeModal() {
            modal.style.display = 'none';
            try { link && link.focus(); } catch (_) {}
          }

          link.addEventListener('click', function (e) { e.preventDefault(); openModal(); });
          modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
          if (closeBtn) closeBtn.addEventListener('click', closeModal);
          document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.style.display !== 'none') closeModal(); });

          renderLicenses(currentLang);
        }

        // FAQ accordion behavior
        function initFAQ() {
          const items = document.querySelectorAll('.faq-q');
          if (!items || !items.length) return;
          items.forEach((btn) => {
            btn.addEventListener('click', function(){
              const id = this.getAttribute('aria-controls');
              const panel = id ? document.getElementById(id) : null;
              const expanded = this.getAttribute('aria-expanded') === 'true';
              this.setAttribute('aria-expanded', expanded ? 'false' : 'true');
              if (panel) panel.hidden = expanded;
            });
          });
        }

        var moneyFlashObserver = null;
        var moneyFlashFallbackPending = [];
        var moneyFlashFallbackBound = false;

        function revealMoneyFlashBox(el) {
          if (!el) return;
          if (el.getAttribute('data-money-flash-done') === '1') return;
          el.setAttribute('data-money-flash-done', '1');
          el.classList.add('is-money-flash-visible');
        }

        function flushMoneyFlashFallback() {
          var vh = window.innerHeight || document.documentElement.clientHeight || 0;
          moneyFlashFallbackPending = moneyFlashFallbackPending.filter(function(box) {
            if (!box || box.getAttribute('data-money-flash-done') === '1') return false;
            try {
              var rect = box.getBoundingClientRect();
              if (rect.top <= vh * 0.82 && rect.bottom >= vh * 0.18) {
                revealMoneyFlashBox(box);
                return false;
              }
            } catch (_) {}
            return true;
          });
          if (!moneyFlashFallbackPending.length && moneyFlashFallbackBound) {
            window.removeEventListener('scroll', flushMoneyFlashFallback);
            window.removeEventListener('resize', flushMoneyFlashFallback);
            moneyFlashFallbackBound = false;
          }
        }

        function observeMoneyFlashBoxes(root) {
          var boxes = [];
          if (root && root.classList && root.classList.contains('money-flash-box')) {
            boxes = [root];
          } else {
            var scope = (root && root.querySelectorAll) ? root : document;
            boxes = Array.prototype.slice.call(scope.querySelectorAll('.money-flash-box'));
          }
          if (!boxes.length) return;

          if (!moneyFlashObserver && 'IntersectionObserver' in window) {
            try {
              moneyFlashObserver = new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                  if (!entry || !entry.isIntersecting) return;
                  revealMoneyFlashBox(entry.target);
                  try { moneyFlashObserver.unobserve(entry.target); } catch (_) {}
                });
              }, {
                root: null,
                rootMargin: '0px 0px -10% 0px',
                threshold: 0.35
              });
            } catch (_) {
              moneyFlashObserver = null;
            }
          }

          boxes.forEach(function(box) {
            if (!box) return;
            if (box.getAttribute('data-money-flash-observed') === '1' || box.getAttribute('data-money-flash-done') === '1') return;
            box.setAttribute('data-money-flash-observed', '1');
            if (moneyFlashObserver) {
              try { moneyFlashObserver.observe(box); } catch (_) {}
            } else {
              moneyFlashFallbackPending.push(box);
            }
          });

          if (!moneyFlashObserver && moneyFlashFallbackPending.length && !moneyFlashFallbackBound) {
            window.addEventListener('scroll', flushMoneyFlashFallback, { passive: true });
            window.addEventListener('resize', flushMoneyFlashFallback);
            moneyFlashFallbackBound = true;
          }
          if (!moneyFlashObserver) flushMoneyFlashFallback();
        }

        function initMoneyFlashBoxes() {
          observeMoneyFlashBoxes(document);
        }

        // Sticky disclaimer init (persist close in localStorage and cookie)
        function initDisclaimer() {
          const bar = document.getElementById('disclaimer');
          const btn = document.getElementById('disclaimer-close');
          const toggle = document.getElementById('disclaimer-toggle');
          if (!bar || !btn) return;
          bar.setAttribute('data-expanded', 'false');
          // Show unless previously closed
          try {
            if (localStorage.getItem('dax_disclaimer_closed') === '1' || getCookie('dax_disclaimer_closed') === '1') {
              bar.style.display = 'none';
            } else {
              bar.style.display = '';
            }
          } catch (_) {
            bar.style.display = '';
          }
          btn.addEventListener('click', function(){
            try { localStorage.setItem('dax_disclaimer_closed', '1'); } catch (_) {}
            try { document.cookie = 'dax_disclaimer_closed=1; max-age=31536000; path=/'; } catch (_) {}
            bar.style.display = 'none';
          });
          if (toggle) {
            const updateToggle = function () {
              const t = i18n[currentLang] || i18n.en;
              const expanded = bar.getAttribute('data-expanded') === 'true';
              const lbl = expanded ? (t.disclaimer_less || 'less') : (t.disclaimer_more || 'more');
              toggle.textContent = lbl;
              toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            };
            updateToggle();
            toggle.addEventListener('click', function () {
              const expanded = bar.getAttribute('data-expanded') === 'true';
              bar.setAttribute('data-expanded', expanded ? 'false' : 'true');
              updateToggle();
            });
          }
        }

        function init() {
          initBackgroundParallax();
          initThemeToggle();
          initStartOverlay();
          initLanguage();
          initDisclaimer();
          initImpressum();
          initLicenses();
          initIntroSlides();
          initMoneyFlashBoxes();
          initFAQ();
          function getSetupOfDayScrollTarget() {
            var todayBox = document.querySelector('.today-box');
            try {
              if (todayBox && todayBox.getClientRects && todayBox.getClientRects().length > 0) {
                return todayBox;
              }
            } catch (_) {}
            return document.getElementById('setup');
          }
          function scrollToSetupOfDay(behavior) {
            var el = getSetupOfDayScrollTarget();
            if (!el) return;
            try { el.scrollIntoView({ behavior: behavior || 'smooth', block: 'start' }); } catch (_) {}
          }
          // Bind down-arrow scroll (desktop only)
          (function(){
            if (isMobile()) return;
            var btn = document.getElementById('intro-down');
            if (!btn) return;
            btn.addEventListener('click', function(){
              scrollToSetupOfDay('smooth');
            });
          })();
          // Bind top-nav setup link to the same destination as the down-arrow
          (function(){
            var link = document.getElementById('nav-setup');
            if (!link) return;
            link.addEventListener('click', function(e){
              try { e.preventDefault(); } catch (_) {}
              scrollToSetupOfDay('smooth');
            });
          })();
          (function(){
            var link = document.getElementById('nav-home');
            if (!link) return;
            link.addEventListener('click', function(e){
              try { e.preventDefault(); } catch (_) {}
              try { window.location.reload(); } catch (_) {
                try { window.location.href = window.location.href; } catch (_) {}
              }
            });
          })();
          // Subscribe form handler (Setup Of The Day)
          (function(){
            var btn = document.getElementById('sotd-subscribe');
            var input = document.getElementById('sotd-email');
            var statusEl = document.getElementById('sotd-status');
            if (!btn || !input) return;
            function t(k){ var t=i18n[currentLang]||i18n.en; return t[k]||k; }
            btn.textContent = t('sub_btn');
            function submit(){
              var email = (input.value||'').trim();
              if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { if(statusEl) statusEl.textContent = t('sub_err_email'); return; }
              if (statusEl) statusEl.textContent = '';
              btn.disabled = true;
              fetchFormTokens().then(function(tok){
                var ts = '';
                var sig = '';
                try {
                  ts = (tok && tok.subscribe && tok.subscribe.ts) ? tok.subscribe.ts : '';
                  sig = (tok && tok.subscribe && tok.subscribe.ttoken) ? tok.subscribe.ttoken : '';
                } catch (_) {}
                return fetch('/subscribe/', {
                  method: 'POST',
                  credentials: 'same-origin',
                  headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                  body: JSON.stringify({ email: email, ts: ts, ttoken: sig, homepage: '', lang: (currentLang==='de'?'de':'en') })
                });
              }).then(async function(r){
                var data={}; try{ data = await r.json(); }catch(_){}
                if (r.ok && data && data.ok) { if (statusEl) statusEl.textContent = t('sub_ok'); }
                else { if (statusEl) statusEl.textContent = t('sub_error'); }
              }).catch(function(){ if(statusEl) statusEl.textContent = t('sub_error'); })
                .finally(function(){ btn.disabled = false; });
            }
            btn.addEventListener('click', submit);
            input.addEventListener('keypress', function(e){ if (e.key === 'Enter') { e.preventDefault(); submit(); } });
          })();
          // Position the down arrow (desktop only)
          (function(){
            if (isMobile()) return;
            var btn = document.getElementById('intro-down');
            var grid = document.querySelector('.intro-grid');
            var sec = document.getElementById('intro');
            if (!btn || !grid || !sec) return;
            function place(){
              var btnH = btn.offsetHeight || 88;
              var sectionH = sec.offsetHeight;
              var gridBottom = grid.offsetTop + grid.offsetHeight;
              var free = Math.max(0, sectionH - gridBottom);
              var center = gridBottom + (free > 80 ? free/2 : (24 + btnH/2));
              var top = Math.max(gridBottom + 16, center - btnH/2);
              btn.style.top = top + 'px';
            }
            window._placeIntroArrow = place;
            window.addEventListener('resize', place);
            setTimeout(place, 60);
          })();
          // Auto-scroll to setup for returning visitors after start animation
          (function(){
            var visitedStorageKey = 'visited';
            var visitedCookieName = 'visited';
            var oneYearSeconds = 60 * 60 * 24 * 365;

            function readCookie(name) {
              try {
                var prefix = name + '=';
                var entries = document.cookie ? document.cookie.split(';') : [];
                for (var i = 0; i < entries.length; i += 1) {
                  var entry = entries[i].trim();
                  if (entry.indexOf(prefix) === 0) {
                    return entry.slice(prefix.length);
                  }
                }
                return null;
              } catch (_) {
                return null;
              }
            }
            function setCookie(name, value, maxAgeSeconds) {
              try {
                var cookie = name + '=' + value;
                if (typeof maxAgeSeconds === 'number') {
                  cookie += '; max-age=' + maxAgeSeconds;
                }
                cookie += '; path=/';
                document.cookie = cookie;
              } catch (_) {}
            }
            function hasVisited() {
              try { if (localStorage.getItem(visitedStorageKey) === '1') return true; } catch (_) {}
              return readCookie(visitedCookieName) === '1';
            }
            function markVisited() {
              try { localStorage.setItem(visitedStorageKey, '1'); } catch (_) {}
              setCookie(visitedCookieName, '1', oneYearSeconds);
            }
            var previously = hasVisited();
            markVisited();
            if (!previously) return; // first-time visitors stay at top
            function go() {
              scrollToSetupOfDay('smooth');
            }
            var fired = false;
            var run = function(){
              if (fired) return;
              fired = true;
              setTimeout(go, 260);
            };
            onStartOverlayDone(run);
          })();
          window._has_running = false;
          window._has_closed = false;
          window._visible_running_count = 0;
          window._visible_closed_count = 0;
          runningPanelLoaded = false;
          closedPanelLoaded = false;
          initTopChartLazyLoad();
          scheduleTopChartAutoLoad();
          loadData();
          renderActivityFeed();
          loadRunning();
          loadClosed();
          // Keep observer registration resilient across late layout changes.
          window.addEventListener('load', function(){
            try {
              initTopChartLazyLoad();
            } catch (_) {}
          }, { once: true });
        }

        // Guided stepper controller for the intro start guide
        function initIntroSlides() {
          var stepper = document.querySelector('.guide-stepper');
          if (!stepper) {
            window._recalcIntroSliderHeight = function () {};
            return;
          }
          var panels = Array.prototype.slice.call(stepper.querySelectorAll('.guide-step-panel'));
          var dots = Array.prototype.slice.call(stepper.querySelectorAll('.guide-step-dot'));
          var prevBtn = document.getElementById('guide-prev');
          var nextBtn = document.getElementById('guide-next');
          var total = panels.length || 0;

          function clampStep(n) {
            if (!total) return 1;
            if (n < 1) return 1;
            if (n > total) return total;
            return n;
          }

          function currentStep() {
            return clampStep(parseInt(stepper.getAttribute('data-current-step') || '1', 10) || 1);
          }

          function isGuideOpen() {
            return stepper.getAttribute('data-guide-open') === 'true';
          }

          function showStep(step, opts) {
            var n = clampStep(parseInt(String(step), 10) || 1);
            stepper.setAttribute('data-current-step', String(n));

            panels.forEach(function (panel) {
              var isActive = String(panel.getAttribute('data-step')) === String(n);
              panel.classList.toggle('is-active', isActive);
              panel.removeAttribute('hidden');
              panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
              if (isActive) panel.removeAttribute('inert');
              else panel.setAttribute('inert', '');
            });

            dots.forEach(function (dot) {
              var isActive = String(dot.getAttribute('data-step-dot')) === String(n);
              dot.classList.toggle('is-active', isActive);
            });

            if (prevBtn) prevBtn.disabled = (n <= 1);
            if (nextBtn) nextBtn.disabled = (n >= total);
          }

          window._recalcIntroSliderHeight = function () {
            currentStep();
          };

          document.addEventListener('click', function (e) {
            var tgt = e.target;
            if (!tgt || typeof tgt.closest !== 'function') return;

            var linkEl = tgt.closest('#start-guide-link');
            if (linkEl) {
              e.preventDefault();
              stepper.setAttribute('data-guide-open', 'true');
              showStep(2);
              try {
                var top = stepper.getBoundingClientRect().top + window.scrollY - 96;
                window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
              } catch (_) {}
              return;
            }

            var prevEl = tgt.closest('#guide-prev');
            if (prevEl) {
              e.preventDefault();
              showStep(currentStep() - 1);
              return;
            }

            var nextEl = tgt.closest('#guide-next');
            if (nextEl) {
              e.preventDefault();
              showStep(currentStep() + 1);
            }
          });

          if (!isGuideOpen()) {
            stepper.setAttribute('data-guide-open', 'false');
          }
          showStep(1);
        }

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', init);
        } else {
          init();
        }
      })();
