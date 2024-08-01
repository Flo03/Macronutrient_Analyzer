document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('imageInput');
    const cameraButton = document.getElementById('cameraButton');
    const cameraStream = document.getElementById('cameraStream');
    const captureButton = document.getElementById('captureButton');
    const cameraCapture = document.getElementById('cameraCapture');
    const resultDiv = document.getElementById('result');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const chatButton = document.getElementById('chatButton');
    const chatSection = document.getElementById('chatSection');
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');
    const chatBox = document.getElementById('chatBox');
    const clearChat = document.getElementById('clearChat');

    let stream;

    // Toggle chat section
    chatButton.addEventListener('click', () => {
        chatSection.classList.toggle('active');
        if (chatSection.classList.contains('active')) {
            chatSection.style.animation = 'slideUp 0.5s forwards';
        }
    });

    // Clear chat
    clearChat.addEventListener('click', () => {
        chatBox.innerHTML = '';
    });

    // Camera functionality
    cameraButton.addEventListener('click', async () => {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
            cameraStream.srcObject = stream;
            cameraStream.classList.add('active');
            captureButton.style.display = 'block';
            console.log("Camera stream started.");
        } catch (error) {
            alert('Error accessing camera: ' + error.message);
            console.error("Camera error: ", error);
        }
    });

    captureButton.addEventListener('click', () => {
        cameraCapture.width = cameraStream.videoWidth;
        cameraCapture.height = cameraStream.videoHeight;
        const context = cameraCapture.getContext('2d');
        context.drawImage(cameraStream, 0, 0, cameraCapture.width, cameraCapture.height);
        const imageData = cameraCapture.toDataURL('image/png');
        console.log("Image captured from camera.");
        sendImageToServer(imageData);
        stopCameraStream();
    });

    function stopCameraStream() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            cameraStream.classList.remove('active');
            captureButton.style.display = 'none';
            console.log("Camera stream stopped.");
        }
    }

    // File upload functionality
    imageInput.addEventListener('change', () => {
        const file = imageInput.files[0];
        const reader = new FileReader();
        reader.onloadend = () => {
            const imageData = reader.result;
            console.log("Image uploaded from file.");
            sendImageToServer(imageData);
            displayUploadedImage(imageData);
        };
        reader.readAsDataURL(file);
    });

    // Send image to server for analysis
    async function sendImageToServer(imageData) {
        try {
            loadingSpinner.style.display = 'block';
            loadingSpinner.style.margin = '20px auto';
            resultDiv.innerHTML = '';
            console.log("Sending image to server.");
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageData })
            });
            if (!response.ok) throw new Error('Failed to fetch data');
            const result = await response.json();
            console.log("Response received from server: ", result);
            displayResult(result);
        } catch (error) {
            resultDiv.innerHTML = `<p>Error: ${error.message}</p>`;
            console.error("Error sending image to server: ", error);
        } finally {
            loadingSpinner.style.display = 'none';
        }
    }

    // Display analysis result
    function displayResult(result) {
        if (result.error) {
            resultDiv.innerHTML = `<p>Error: ${result.error}</p>`;
            console.error("Server returned error: ", result.error);
        } else {
            resultDiv.innerHTML = `
                <div>
                    <p>${result.calories || 'N/A'} </p>
                    <p>${result.protein || 'N/A'} </p>
                    <p>${result.carbs || 'N/A'} </p>
                    <p>${result.fat || 'N/A'} </p>
                    <p>${result.sugar || 'N/A'} </p>
                    <p>${result.cholesterol || 'N/A'} </p>
                    <br>
                    <p>👍 Thank you for uploading! Knowing your macros helps in maintaining a healthy lifestyle. 💪</p>
                    <br>
                </div>
            `;
            console.log("Displaying result: ", result);
        }
    }

    // Display uploaded image
    function displayUploadedImage(imageData) {
        const imgElement = document.createElement('img');
        imgElement.src = imageData;
        imgElement.alt = 'Uploaded Food Image';
        imgElement.style.borderRadius = '10px';
        imgElement.style.boxShadow = '0 5px 15px rgba(0, 230, 118, 0.4)';
        imgElement.style.width = '300px';
        imgElement.style.height = '300px';
        imgElement.style.objectFit = 'cover';
        imgElement.style.marginBottom = '20px';
        if (resultDiv.firstChild) {
            resultDiv.insertBefore(imgElement, resultDiv.firstChild);
        } else {
            resultDiv.appendChild(imgElement);
        }
    }

    // Chatbot functionality
    sendButton.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });

    async function sendMessage() {
        const userMessage = chatInput.value.trim();
        if (!userMessage) return;

        displayMessage(userMessage, 'user');
        chatInput.value = '';

        displayTypingIndicator(); // Show typing indicator

        try {
            const response = await fetch('/chatbot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage })
            });
            if (!response.ok) throw new Error('Failed to fetch data');
            const result = await response.json();
            removeTypingIndicator(); // Remove typing indicator
            displayMessage(result.reply, 'bot');
        } catch (error) {
            removeTypingIndicator(); // Remove typing indicator
            displayMessage(`Error: ${error.message}`, 'bot');
        }
    }

    function displayMessage(message, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);
        messageDiv.innerText = message;
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;

        // Apply animation to each message
        messageDiv.style.animation = 'fadeIn 0.5s';
    }

    function displayTypingIndicator() {
        const typingIndicator = document.createElement('div');
        typingIndicator.classList.add('typing-indicator');
        typingIndicator.innerHTML = `
            <span>Floflo is typing</span>
            <div class="dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        `;
        chatBox.appendChild(typingIndicator);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function removeTypingIndicator() {
        const typingIndicator = chatBox.querySelector('.typing-indicator');
        if (typingIndicator) {
            chatBox.removeChild(typingIndicator);
        }
    }

    // Encouraging messages
    const messages = [
        "Keep going! Diabetes is not the end. 💪",
        "You're doing great! Every step counts. 🌟",
        "Stay strong! Your health journey is worth it. 🏆",
        "Remember, every small change matters. 🌈",
        "You've got this! Keep pushing forward. 💥",
        "Stay positive and take care of yourself. 🌸",
        "Every day is a new opportunity to improve. 🌞",
        "Believe in yourself and all that you are. ✨",
        "Your strength and determination are inspiring! 💪",
        "Healthy choices, happy life! 🥗",
        "Progress is progress, no matter how small. 🌟",
        "One step at a time, you've got this! 🚶",
        "Your effort is making a difference. Keep it up! 💪",
        "You're stronger than you think! 🌟",
        "Every healthy choice counts. 🥗",
        "Keep moving forward, you're doing great! 🚶",
        "Believe in your journey. 🌟",
        "Your hard work is paying off. Keep going! 🏆",
        "Health is the greatest wealth. 🌸",
        "Stay motivated and stay strong! 💪",
        "Take care of yourself, you deserve it. 🌼",
        "You are capable of amazing things. 🌟",
        "Keep your head up and your heart strong. 💖",
        "Every effort is a step towards success. 🌈",
        "Stay focused, stay healthy. 🏃",
        "You're making a positive change in your life. 🌟",
        "Keep smiling and stay positive! 😊",
        "Your journey is unique and special. 🌟",
        "Stay strong, stay motivated. 💪",
        "You are doing an amazing job! 🌟"
    ];

    function showEncouragingMessage() {
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('encouraging-message');
        messageDiv.innerText = randomMessage;
        document.body.appendChild(messageDiv);
        setTimeout(() => {
            document.body.removeChild(messageDiv);
        }, 20000);
    }

    // Show an encouraging message every 25 seconds
    setInterval(showEncouragingMessage, 25000);
});
