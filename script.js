// Wait for page to load
window.addEventListener('load', () => {
    const canvas = document.getElementById('confetti-canvas');
    const ctx = canvas.getContext('2d');
    const dogImage = document.getElementById('dog-image');
    const message = document.getElementById('message');
    const petInstruction = document.getElementById('pet-instruction');
    
    // Get audio element and enable audio on first user interaction
    const fartSound = document.getElementById('fart-sound');
    let audioEnabled = false;
    let audioPlayed = false;
    
    // Function to enable audio (called on first user interaction)
    function enableAudio() {
        if (!audioEnabled && fartSound) {
            // Try to play and pause to unlock audio
            const playPromise = fartSound.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    fartSound.pause();
                    fartSound.currentTime = 0;
                    audioEnabled = true;
                }).catch(() => {
                    audioEnabled = true; // Still mark as enabled even if play fails
                });
            } else {
                audioEnabled = true;
            }
        }
    }
    
    // Function to play fart sound
    function playFartSound() {
        if (fartSound && !audioPlayed) {
            if (audioEnabled) {
                fartSound.play().then(() => {
                    audioPlayed = true;
                }).catch(error => {
                    console.log('Audio play failed:', error);
                });
            } else {
                // If audio not enabled yet, try anyway (might work in some browsers)
                fartSound.play().then(() => {
                    audioPlayed = true;
                    audioEnabled = true;
                }).catch(() => {
                    // Will need user interaction
                });
            }
        }
    }
    
    // Enable audio on any user interaction (click, touch, keypress)
    document.addEventListener('click', enableAudio, { once: true });
    document.addEventListener('touchstart', enableAudio, { once: true });
    document.addEventListener('keydown', enableAudio, { once: true });
    
    // Also try to enable on page load (might work in some browsers)
    enableAudio();
    
    // Set canvas size to cover dog container plus confetti area
    function resizeCanvas() {
        const container = dogImage.parentElement;
        const rect = dogImage.getBoundingClientRect();
        
        // Canvas needs to be wider to accommodate confetti to the right
        const confettiWidth = 400; // Extra width for confetti
        const canvasWidth = container.offsetWidth + confettiWidth;
        const canvasHeight = Math.max(container.offsetHeight, rect.height + 200);
        
        // Set canvas internal resolution
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // Set canvas display size
        canvas.style.width = canvasWidth + 'px';
        canvas.style.height = canvasHeight + 'px';
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Load the confetti image
    const confettiImage = new Image();
    const confettiImagePromise = new Promise((resolve, reject) => {
        confettiImage.onload = () => resolve(confettiImage);
        confettiImage.onerror = () => reject(new Error('Failed to load confetti.png'));
    });
    confettiImage.src = 'confetti.png';
    
    // Confetti particle class using loaded images
    class ConfettiParticle {
        constructor(x, y, image, targetX, targetY) {
            this.startX = x;
            this.startY = y;
            this.x = x;
            this.y = y;
            this.targetX = targetX; // Target position in triangle
            this.targetY = targetY;
            this.image = image;
            
            // Calculate direction to target (spraying LEFT)
            const dx = targetX - x;
            const dy = targetY - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const speed = Math.random() * 6 + 4; // Initial burst speed
            
            // Velocity pointing LEFT toward target position
            this.vx = (dx / distance) * speed;
            this.vy = (dy / distance) * speed;
            
            // Add some randomness for natural spread
            this.vx += (Math.random() - 0.5) * 2;
            this.vy += (Math.random() - 0.5) * 2;
            
            this.rotation = Math.random() * Math.PI * 2;
            this.rotationSpeed = (Math.random() - 0.5) * 0.2;
            this.finalRotation = this.rotation + (Math.random() - 0.5) * Math.PI * 0.5;
            this.scale = Math.random() * 0.3 + 0.25; // Smaller confetti (0.25 to 0.55 scale)
            this.isSettled = false;
            this.distanceTraveled = 0;
        }
        
        update() {
            if (this.isSettled) {
                // Once settled, particles stay completely still - NO animation
                return;
            }
            
            // Fast movement toward target with easing
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            const distanceToTarget = Math.sqrt(dx * dx + dy * dy);
            
            if (distanceToTarget < 2) {
                // Close enough - snap to position and settle
                this.isSettled = true;
                this.x = this.targetX;
                this.y = this.targetY;
                this.vx = 0;
                this.vy = 0;
                this.rotationSpeed = 0;
                this.rotation = this.finalRotation; // Set final rotation immediately
                return;
            }
            
            // Move quickly toward target with easing (faster to complete in 3 seconds)
            const speed = 0.4; // Easing factor (increased to ensure completion within 3 seconds)
            this.x += dx * speed;
            this.y += dy * speed;
            
            // Rotate toward final rotation
            const rotationDiff = this.finalRotation - this.rotation;
            if (Math.abs(rotationDiff) > 0.1) {
                this.rotation += rotationDiff * 0.2;
            } else {
                this.rotation = this.finalRotation;
            }
        }
        
        draw() {
            if (!this.image.complete || !this.image.naturalWidth) return;
            
            ctx.save();
            ctx.globalAlpha = 1.0; // Always fully visible
            
            // Calculate dimensions
            const width = this.image.width * this.scale;
            const height = this.image.height * this.scale;
            
            // Make sure we have valid dimensions
            if (width <= 0 || height <= 0) return;
            
            // Translate to center, rotate, then translate back
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);
            ctx.drawImage(
                this.image,
                -width / 2,
                -height / 2,
                width,
                height
            );
            
            ctx.restore();
        }
        
        isDead() {
            return false; // Particles never die, they stay visible
        }
    }
    
    // Main animation
    const particles = [];
    const burstDuration = 200; // Short burst period (200ms)
    const totalAnimationDuration = 3000; // Total animation time: 3 seconds to match audio
    let animationComplete = false;
    let imagesLoaded = false;
    let startTime = null;
    let particlesCreated = false;
    let animationStarted = false; // Track if animation has been started
    
    function getEmissionPoint() {
        // Get the right side of the dog image (where the rear would be)
        // Calculate position relative to the canvas (which is positioned at container's top-left)
        const container = dogImage.parentElement;
        const containerRect = container.getBoundingClientRect();
        const imageRect = dogImage.getBoundingClientRect();
        
        // Calculate offset of image relative to container
        const offsetX = imageRect.left - containerRect.left;
        const offsetY = imageRect.top - containerRect.top;
        
        // Position at the RIGHT EDGE of the dog (outside the dog), lower area
        return {
            x: offsetX + imageRect.width, // Right edge of the dog (outside)
            y: offsetY + imageRect.height * 0.85 // Lower position
        };
    }
    
    function createConfettiBurst() {
        if (particlesCreated || !imagesLoaded) return;
        
        // Resize canvas to ensure it's correct size
        resizeCanvas();
        
        const emissionPoint = getEmissionPoint();
        const numParticles = 5; // Create all particles at once
        
        // Create triangular formation: narrow at dog, wider to the right
        // Use deterministic distribution for consistent triangle shape
        const maxDistance = 150; // How far RIGHT the triangle extends
        const maxHeight = 180; // Maximum vertical spread at the far right (triangle height)
        
        // Distribute particles evenly across the triangle
        for (let i = 0; i < numParticles; i++) {
            // Horizontal position: evenly spaced from start to end
            const progress = i / Math.max(1, numParticles - 1); // 0 to 1, evenly distributed
            const distanceRight = progress * maxDistance;
            
            // Vertical spread increases linearly with distance (triangle shape)
            // At progress 0: spread = 0 (narrow at dog)
            // At progress 1: spread = maxHeight (wide at right)
            const verticalSpread = maxHeight * progress;
            
            // Vertical position: distribute particles across the spread at this distance
            // Alternate between top and bottom of the spread to fill the triangle
            const verticalPosition = i === 0 ? 0 : // First particle at center (narrow)
                (i % 2 === 1 ? -verticalSpread * 0.5 : verticalSpread * 0.5); // Alternate top/bottom
            
            // Final position - deterministic, always follows triangle
            const finalX = emissionPoint.x + distanceRight;
            const finalY = emissionPoint.y + verticalPosition;
            
            // Start particles at the emission point (dog's butt, outside the dog) - no randomness
            particles.push(new ConfettiParticle(
                emissionPoint.x, // Start exactly at emission point
                emissionPoint.y,
                confettiImage,
                finalX,
                finalY
            ));
        }
        
        particlesCreated = true;
    }
    
    function animate() {
        if (!animationStarted) return; // Don't animate until started
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (!startTime) {
            startTime = Date.now();
        }
        
        const elapsed = Date.now() - startTime;
        
        // Create all particles in a quick burst at the start
        if (elapsed < burstDuration && imagesLoaded && !particlesCreated) {
            createConfettiBurst();
        }
        
        let allSettled = true;
        
        // Update and draw all particles
        for (let i = 0; i < particles.length; i++) {
            const particle = particles[i];
            if (!particle.isSettled) {
                particle.update();
                allSettled = false;
            }
            particle.draw();
        }
        
        // Show message after 2 seconds (faster appearance)
        if (elapsed >= 2000 && !animationComplete) {
            animationComplete = true;
            message.classList.add('show');
        }
        
        // Keep drawing (particles are static once settled, but canvas needs to stay visible)
        requestAnimationFrame(animate);
    }
    
    // Function to start the animation (called when dog is clicked)
    function startAnimation() {
        if (!imagesLoaded || animationStarted) return; // Wait for images to load, and don't start twice
        
        animationStarted = true;
        
        // Hide the "pet the dawg" instruction
        if (petInstruction) {
            petInstruction.classList.add('hidden');
        }
        
        // Enable audio and play sound
        enableAudio();
        playFartSound();
        
        // Start the animation loop
        animate();
    }
    
    // Wait for confetti image to load
    confettiImagePromise
        .then(() => {
            imagesLoaded = true;
            // Don't start animation automatically - wait for dog click
        })
        .catch((error) => {
            console.error('Error loading confetti image:', error);
            imagesLoaded = true;
        });
    
    // Add click handler to dog image to start animation
    dogImage.addEventListener('click', startAnimation);
});
