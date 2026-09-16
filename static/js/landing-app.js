/**
 * GateKeeper AI — Master Landing Page Controller
 * Handles navbar scroll blur, live backend API telemetry,
 * 3D card tilt physics, modal configurator, and anchor navigation.
 */

(function () {
  'use strict';

  // 1. Navbar Dynamic Scroll Blur
  const navbar = document.getElementById('main-navbar');
  window.addEventListener('scroll', () => {
    if (!navbar) return;
    if (window.scrollY > 40) {
      navbar.classList.add('bg-slate-950/90', 'border-b', 'border-white/10', 'backdrop-blur-xl', 'shadow-2xl');
      navbar.classList.remove('bg-transparent', 'border-transparent');
    } else {
      navbar.classList.remove('bg-slate-950/90', 'border-b', 'border-white/10', 'backdrop-blur-xl', 'shadow-2xl');
      navbar.classList.add('bg-transparent', 'border-transparent');
    }
  });

  // 2. Live Backend Telemetry Hook
  async function fetchLiveTelemetry() {
    try {
      const [statsRes, serialRes] = await Promise.allSettled([
        fetch('/api/stats'),
        fetch('/api/serial/status')
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const stats = await statsRes.value.json();
        const activeCountEl = document.getElementById('telemetry-active-count');
        const totalCountEl = document.getElementById('telemetry-total-count');
        const activeCount = stats.currently_inside ?? stats.active_sessions_count;
        const totalCount = stats.total_entries ?? stats.today_events_count;
        if (activeCountEl && activeCount !== undefined) {
          activeCountEl.textContent = activeCount;
        }
        if (totalCountEl && totalCount !== undefined) {
          totalCountEl.textContent = totalCount;
        }
      }

      if (serialRes.status === 'fulfilled' && serialRes.value.ok) {
        const serial = await serialRes.value.json();
        const serialStatusEl = document.getElementById('telemetry-serial-status');
        if (serialStatusEl) {
          serialStatusEl.textContent = serial.is_connected ? 'COM4 CONNECTED' : 'COM4 SIMULATED STANDBY';
          serialStatusEl.className = serial.is_connected ? 'text-emerald-400 font-mono' : 'text-cyan-400 font-mono';
        }
      }
    } catch (e) {
      // Offline / standalone mode: static fallback remains active
    }
  }

  fetchLiveTelemetry();
  setInterval(fetchLiveTelemetry, 15000);

  // 3. 3D Tilt Card Interaction
  const tiltCards = document.querySelectorAll('.tilt-card');
  tiltCards.forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -8;
      const rotateY = ((x - centerX) / centerX) * 8;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    });
  });

  // 4. Interactive Deployment Configurator Modal
  const modal = document.getElementById('deploy-modal');
  const openModalBtns = document.querySelectorAll('.trigger-deploy-modal');
  const closeModalBtn = document.getElementById('close-deploy-modal');
  const lanesRange = document.getElementById('config-lanes-range');
  const lanesDisplay = document.getElementById('config-lanes-display');
  const throughputDisplay = document.getElementById('config-throughput-display');

  function openModal() {
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
  }

  openModalBtns.forEach((btn) => btn.addEventListener('click', openModal));
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  if (lanesRange && lanesDisplay && throughputDisplay) {
    lanesRange.addEventListener('input', (e) => {
      const lanes = parseInt(e.target.value, 10);
      lanesDisplay.textContent = `${lanes} Lane${lanes > 1 ? 's' : ''}`;
      // Approximate 1,200 vehicles per hour per lane
      const capacity = (lanes * 1200).toLocaleString();
      throughputDisplay.textContent = `~${capacity} Vehicles / Hour Peak`;
    });
  }

  // Lead capture form submit simulation
  const leadForm = document.getElementById('deploy-lead-form');
  const formSuccess = document.getElementById('deploy-form-success');
  if (leadForm && formSuccess) {
    leadForm.addEventListener('submit', (e) => {
      e.preventDefault();
      leadForm.classList.add('hidden');
      formSuccess.classList.remove('hidden');
      setTimeout(() => {
        closeModal();
        leadForm.reset();
        leadForm.classList.remove('hidden');
        formSuccess.classList.add('hidden');
      }, 3500);
    });
  }
})();
