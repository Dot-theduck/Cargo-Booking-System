const FAQData = [
  {
    question: "How Do I Create an Account on the Cargo Booking Website?",
    answer: [
      "To create a new account,look for the button that saya Sign Un or Register. Provide your contact information, create a secure password and accept our terms.After verification, you can log i, browse cargo options, and start booking shipments through our platform.",
    ],
  },
  {
    question: "What Types of Cargo Can I Book Through the Website?",
    answer: [
      "You can book a wide range of cargo throught our website, including perishable goods, harzardous materials and standard cargo. We offer various categories to accommodate diverse shipment needs",
    ],
  },
  {
    question: "What Payment Methods Are Accepted for Cargo Booking?",
    answer: [
      "We accept majorcredit cards exclusively for all cargo bookings. Our system is optimized to process transactions securely and efficiently using credit card payments ",
    ],
  },
  {
    question: "Can I Track the Status of My Shipment?",
    answer: [
      "You can easily track your shipment's status by logging into your account and accessing the tracking features on our website.We provide real-time updates and notifications to keep you informed about your cargo's progress from pickup to delivery",
    ],
  },
];

const FAQContainer = document.querySelector(".faq-container");

const removeAllExpanded = () => {
  const questionContainers = document.querySelectorAll(
    ".faq-container .question-container"
  );

  questionContainers.forEach((q) => {
    q.classList.remove("expanded");
    const answerContainer = q.querySelector(".answer-container");
    answerContainer.style.maxHeight = "0";
  });
};

const displayFAQ = () => {
  FAQData.forEach((q) => {
    const answerHTML = q.answer
      .map(
        (a) => `<div class="answer">
        <span class="answer-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            class="w-5 h-5"
          >
          </svg>
        </span>
        ${a}
      </div>`
      )
      .join("");

    const html = `<div class="question">
          ${q.question}
          <span class="question-icon"
            ><svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-6 h-6"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
          </span>
        </div>

        <div class="answer-container">
          ${answerHTML}
        </div>`;

    const questionContainer = document.createElement("div");
    questionContainer.classList.add("question-container");
    questionContainer.innerHTML = html;

    FAQContainer.appendChild(questionContainer);

    const question = questionContainer.querySelector(".question");

    question.addEventListener("click", () => {
      if (!questionContainer.classList.contains("expanded")) {
        removeAllExpanded();
      }

      questionContainer.classList.toggle("expanded");
      const isExpanded = questionContainer.classList.contains("expanded");

      const answerContainer =
        questionContainer.querySelector(".answer-container");
      const contentHeight = answerContainer.scrollHeight;
      answerContainer.style.maxHeight = isExpanded ? `${contentHeight}px` : "0";
    });
  });
};

displayFAQ();
