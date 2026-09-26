import { useState } from "react";
import axios from "axios";

const API_URL = "http://127.0.0.1:8000";

const languageNames = {
  english: "English",
  tamil: "Tamil",
  hindi: "Hindi",
  telugu: "Telugu",
  malayalam: "Malayalam",
  kannada: "Kannada",
};

function App() {
  // =========================================================
  // DOCUMENT STATE
  // =========================================================

  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  const [language, setLanguage] = useState("english");
  const [displayText, setDisplayText] = useState("");

  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [translating, setTranslating] = useState(false);

  const [error, setError] = useState("");

  // =========================================================
  // DOWNLOAD STATE
  // =========================================================

  const [downloading, setDownloading] = useState("");
  const [downloadError, setDownloadError] = useState("");

  // =========================================================
  // QUIZ STATE
  // =========================================================

  const [quiz, setQuiz] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);

  const [quizDifficulty, setQuizDifficulty] =
    useState("medium");

  const [quizQuestionCount, setQuizQuestionCount] =
    useState(5);

  const [currentQuestion, setCurrentQuestion] =
    useState(0);

  const [selectedAnswer, setSelectedAnswer] =
    useState(null);

  const [quizAnswers, setQuizAnswers] =
    useState({});

  const [quizCompleted, setQuizCompleted] =
    useState(false);

  const [quizScore, setQuizScore] =
    useState(0);

  // =========================================================
  // ASK A2Z STATE
  // =========================================================

  const [chatQuestion, setChatQuestion] =
    useState("");

  const [chatAnswer, setChatAnswer] =
    useState(null);

  const [chatLoading, setChatLoading] =
    useState(false);

  const [chatError, setChatError] =
    useState("");

  // =========================================================
  // LANGUAGE NAME
  // =========================================================

  const targetLanguageName =
    languageNames[language] || language;

  // =========================================================
  // UPLOAD + ANALYZE + TRANSLATE
  // =========================================================

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a PDF or DOCX file.");
      return;
    }

    setUploading(true);
    setAnalyzing(false);
    setTranslating(false);

    setError("");
    setResult(null);
    setAnalysis(null);
    setDisplayText("");

    // Reset quiz
    setQuiz(null);
    setQuizLoading(false);
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setQuizAnswers({});
    setQuizCompleted(false);
    setQuizScore(0);

    // Reset Ask A2Z
    setChatQuestion("");
    setChatAnswer(null);
    setChatLoading(false);
    setChatError("");

    // Reset downloads
    setDownloading("");
    setDownloadError("");

    try {
      // -------------------------------------------------------
      // STEP 1: UPLOAD
      // -------------------------------------------------------

      console.log("Starting document upload...");
      console.log("File:", file.name);

      const formData = new FormData();

      formData.append("file", file);

      const uploadResponse = await axios.post(
        `${API_URL}/api/documents/upload`,
        formData,
        {
          timeout: 300000,
        }
      );

      console.log(
        "UPLOAD RESPONSE:",
        uploadResponse.data
      );

      if (!uploadResponse.data.success) {
        throw new Error(
          uploadResponse.data.error ||
            "Document upload failed."
        );
      }

      const uploadedDocument =
        uploadResponse.data;

      setResult(uploadedDocument);

      if (
        !uploadedDocument.pages ||
        uploadedDocument.pages.length === 0
      ) {
        throw new Error(
          "No text was extracted from the document."
        );
      }

      console.log(
        "Pages extracted:",
        uploadedDocument.pages.length
      );

      // -------------------------------------------------------
      // STEP 2: AI ANALYSIS
      // -------------------------------------------------------

      setUploading(false);
      setAnalyzing(true);

      console.log(
        "Starting AI document analysis..."
      );

      const analysisResponse =
        await axios.post(
          `${API_URL}/api/documents/analyze`,
          {
            pages: uploadedDocument.pages,
            language: language,
          },
          {
            timeout: 300000,
          }
        );

      console.log(
        "AI ANALYSIS RESPONSE:",
        analysisResponse.data
      );

      if (!analysisResponse.data.success) {
        throw new Error(
          analysisResponse.data.error ||
            "AI document analysis failed."
        );
      }

      setAnalysis(
        analysisResponse.data.analysis
      );

      console.log(
        "AI analysis completed successfully."
      );

      // -------------------------------------------------------
      // STEP 3: DOCUMENT TRANSLATION
      // -------------------------------------------------------

      const originalText =
        uploadedDocument.pages
          .map((page) => page.text)
          .join("\n\n");

      if (language === "english") {
        setDisplayText(originalText);
        return;
      }

      setAnalyzing(false);
      setTranslating(true);

      console.log(
        "Starting translation:",
        language
      );

      const translationResponse =
        await axios.post(
          `${API_URL}/api/documents/translate`,
          {
            text: originalText,
            language: language,
          },
          {
            timeout: 300000,
          }
        );

      console.log(
        "TRANSLATION RESPONSE:",
        translationResponse.data
      );

      if (!translationResponse.data.success) {
        throw new Error(
          translationResponse.data.error ||
            "Translation failed."
        );
      }

      setDisplayText(
        translationResponse.data.translated_text
      );

    } catch (error) {
      console.error(
        "UPLOAD / ANALYSIS / TRANSLATION ERROR:",
        error
      );

      if (error.code === "ECONNABORTED") {
        setError(
          "Request timed out. Please check whether the backend is running."
        );
      } else if (error.response) {
        setError(
          error.response.data?.error ||
            error.response.data?.detail ||
            `Server error: ${error.response.status}`
        );
      } else {
        setError(
          error.message ||
            "Something went wrong."
        );
      }

    } finally {
      setUploading(false);
      setAnalyzing(false);
      setTranslating(false);
    }
  };

  // =========================================================
  // LANGUAGE CHANGE
  // =========================================================

  const handleLanguageChange = async (event) => {
    const selectedLanguage =
      event.target.value;

    setLanguage(selectedLanguage);
    setError("");

    // Reset quiz
    setQuiz(null);
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setQuizAnswers({});
    setQuizCompleted(false);
    setQuizScore(0);

    // Reset Ask A2Z
    setChatAnswer(null);
    setChatError("");

    // Reset downloads
    setDownloading("");
    setDownloadError("");

    if (
      !result ||
      !result.pages?.length
    ) {
      return;
    }

    const originalText =
      result.pages
        .map((page) => page.text)
        .join("\n\n");

    try {
      // -------------------------------------------------------
      // ENGLISH
      // -------------------------------------------------------

      if (selectedLanguage === "english") {
        setDisplayText(originalText);

        setAnalyzing(true);

        const response =
          await axios.post(
            `${API_URL}/api/documents/analyze`,
            {
              pages: result.pages,
              language: "english",
            },
            {
              timeout: 180000,
            }
          );

        if (!response.data.success) {
          throw new Error(
            response.data.error ||
              "Analysis failed."
          );
        }

        setAnalysis(
          response.data.analysis
        );

        setAnalyzing(false);

        return;
      }

      // -------------------------------------------------------
      // RE-ANALYZE IN SELECTED LANGUAGE
      // -------------------------------------------------------

      setAnalyzing(true);

      console.log(
        "Re-analyzing in:",
        selectedLanguage
      );

      const analysisResponse =
        await axios.post(
          `${API_URL}/api/documents/analyze`,
          {
            pages: result.pages,
            language: selectedLanguage,
          },
          {
            timeout: 180000,
          }
        );

      if (
        !analysisResponse.data.success
      ) {
        throw new Error(
          analysisResponse.data.error ||
            "AI analysis failed."
        );
      }

      setAnalysis(
        analysisResponse.data.analysis
      );

      setAnalyzing(false);

      // -------------------------------------------------------
      // TRANSLATE COMPLETE DOCUMENT
      // -------------------------------------------------------

      setTranslating(true);

      const translationResponse =
        await axios.post(
          `${API_URL}/api/documents/translate`,
          {
            text: originalText,
            language: selectedLanguage,
          },
          {
            timeout: 180000,
          }
        );

      if (
        !translationResponse.data.success
      ) {
        throw new Error(
          translationResponse.data.error ||
            "Translation failed."
        );
      }

      setDisplayText(
        translationResponse.data
          .translated_text
      );

    } catch (error) {
      console.error(
        "LANGUAGE CHANGE ERROR:",
        error
      );

      setError(
        error.response?.data?.error ||
          error.response?.data?.detail ||
          error.message ||
          "Language change failed."
      );

    } finally {
      setAnalyzing(false);
      setTranslating(false);
    }
  };

  // =========================================================
  // ASK A2Z
  // =========================================================

  const askA2Z = async () => {
    if (!chatQuestion.trim()) {
      return;
    }

    if (
      !result ||
      !result.pages ||
      result.pages.length === 0
    ) {
      setChatError(
        "Please upload and analyze a document first."
      );

      return;
    }

    try {
      setChatLoading(true);
      setChatError("");
      setChatAnswer(null);

      console.log(
        "ASK A2Z QUESTION:",
        chatQuestion
      );

      console.log(
        "ASK A2Z LANGUAGE:",
        language
      );

      const response =
        await axios.post(
          `${API_URL}/api/chat`,
          {
            question:
              chatQuestion.trim(),
            pages: result.pages,
            language: language,
          },
          {
            timeout: 180000,
          }
        );

      console.log(
        "ASK A2Z RESPONSE:",
        response.data
      );

      if (!response.data.success) {
        throw new Error(
          response.data.error ||
            "Ask A2Z failed."
        );
      }

      setChatAnswer(
        response.data.answer
      );

    } catch (error) {
      console.error(
        "ASK A2Z ERROR:",
        error
      );

      setChatError(
        error.response?.data?.error ||
          error.response?.data?.detail ||
          error.message ||
          "Unable to get an answer from Ask A2Z."
      );

    } finally {
      setChatLoading(false);
    }
  };

  // =========================================================
  // DOWNLOAD DOCUMENT
  // =========================================================

  const downloadDocument = async (format) => {
    if (
      !displayText ||
      !displayText.trim()
    ) {
      setDownloadError(
        "Please analyze the document first."
      );

      return;
    }

    try {
      setDownloading(format);
      setDownloadError("");

      const endpoint =
        format === "docx"
          ? `${API_URL}/api/documents/download/docx`
          : `${API_URL}/api/documents/download/pdf`;

      console.log(
        "DOWNLOAD FORMAT:",
        format
      );

      const response =
        await axios.post(
          endpoint,
          {
            text: displayText,
            language: language,
            filename:
              result?.filename ||
              "LearnA2Z_Document",
          },
          {
            responseType: "blob",
            timeout: 180000,
          }
        );

      const blob = new Blob(
        [response.data],
        {
          type:
            format === "docx"
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : "application/pdf",
        }
      );

      const url =
        window.URL.createObjectURL(
          blob
        );

      const link =
        document.createElement("a");

      link.href = url;

      const originalName =
        result?.filename ||
        "LearnA2Z_Document";

      const cleanName =
        originalName
          .replace(/\.[^/.]+$/, "")
          .replace(/\s+/g, "_");

      link.download =
        `LearnA2Z_${cleanName}_${language}.${format}`;

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error(
        "DOWNLOAD ERROR:",
        error
      );

      setDownloadError(
        error.response?.data?.error ||
          "Unable to download the document. Please try again."
      );

    } finally {
      setDownloading("");
    }
  };

  // =========================================================
  // GENERATE QUIZ
  // =========================================================

  const generateQuiz = async () => {
    if (!analysis) {
      setError(
        "Please analyze the document first."
      );

      return;
    }

    if (
      (!analysis.concepts ||
        analysis.concepts.length === 0) &&
      (!analysis.questions ||
        analysis.questions.length === 0)
    ) {
      setError(
        "No concepts or document questions are available for the quiz."
      );

      return;
    }

    try {
      setQuizLoading(true);
      setError("");

      console.log(
        "Starting quiz generation..."
      );

      const response =
        await axios.post(
          `${API_URL}/api/documents/quiz`,
          {
            concepts:
              analysis.concepts || [],

            questions:
              analysis.questions || [],

            language:
              language,

            difficulty:
              quizDifficulty,

            question_count:
              quizQuestionCount,
          },
          {
            timeout: 180000,
          }
        );

      console.log(
        "QUIZ RESPONSE:",
        response.data
      );

      if (!response.data.success) {
        throw new Error(
          response.data.error ||
            "Quiz generation failed."
        );
      }

      const generatedQuiz =
        response.data.quiz;

      if (
        !generatedQuiz ||
        !Array.isArray(
          generatedQuiz.questions
        ) ||
        generatedQuiz.questions.length === 0
      ) {
        throw new Error(
          "The backend returned an empty quiz."
        );
      }

      setQuiz(generatedQuiz);

      setCurrentQuestion(0);
      setSelectedAnswer(null);
      setQuizAnswers({});
      setQuizCompleted(false);
      setQuizScore(0);

      console.log(
        "Quiz generated successfully."
      );

    } catch (error) {
      console.error(
        "QUIZ ERROR:",
        error
      );

      setError(
        error.response?.data?.error ||
          error.response?.data?.detail ||
          error.message ||
          "Unable to generate quiz."
      );

    } finally {
      setQuizLoading(false);
    }
  };

  // =========================================================
  // SELECT QUIZ ANSWER
  // =========================================================

  const handleQuizAnswer = (
    answerId
  ) => {
    if (quizCompleted) {
      return;
    }

    setSelectedAnswer(answerId);

    setQuizAnswers(
      (previous) => ({
        ...previous,
        [currentQuestion]:
          answerId,
      })
    );
  };

  // =========================================================
  // NEXT QUESTION
  // =========================================================

  const handleNextQuestion = () => {
    if (
      !quiz ||
      selectedAnswer === null
    ) {
      return;
    }

    const questions =
      quiz.questions || [];

    const updatedAnswers = {
      ...quizAnswers,
      [currentQuestion]:
        selectedAnswer,
    };

    setQuizAnswers(
      updatedAnswers
    );

    // More questions
    if (
      currentQuestion <
      questions.length - 1
    ) {
      const nextIndex =
        currentQuestion + 1;

      setCurrentQuestion(
        nextIndex
      );

      const nextAnswer =
        updatedAnswers[
          nextIndex
        ];

      setSelectedAnswer(
        nextAnswer !== undefined
          ? nextAnswer
          : null
      );

      return;
    }

    // -------------------------------------------------------
    // CALCULATE SCORE
    // -------------------------------------------------------

    let correct = 0;

    questions.forEach(
      (question, index) => {
        if (
          updatedAnswers[index] ===
          question.correct_answer
        ) {
          correct++;
        }
      }
    );

    setQuizScore(correct);
    setQuizCompleted(true);
  };

  // =========================================================
  // RESTART QUIZ
  // =========================================================

  const restartQuiz = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setQuizAnswers({});
    setQuizCompleted(false);
    setQuizScore(0);
  };

  // =========================================================
  // CLOSE QUIZ
  // =========================================================

  const closeQuiz = () => {
    setQuiz(null);
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setQuizAnswers({});
    setQuizCompleted(false);
    setQuizScore(0);
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#12131a",
        color: "#f5f5f5",
        fontFamily:
          "Arial, Helvetica, sans-serif",
      }}
    >

      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding:
            "40px 25px 80px",
        }}
      >

        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <div
          style={{
            textAlign: "center",
            marginBottom: "35px",
          }}
        >

          <h1
            style={{
              fontSize: "46px",
              marginBottom: "8px",
            }}
          >
            🧠 Learn A2Z
          </h1>

          <p
            style={{
              fontSize: "18px",
              color: "#b8b8c2",
              margin: 0,
            }}
          >
            Multilingual Cognitive
            Learning Interface
          </p>

        </div>


        {/* ================================================= */}
        {/* UPLOAD PANEL */}
        {/* ================================================= */}

        <div
          style={{
            background: "#1b1d27",
            border:
              "1px solid #303341",
            borderRadius: "16px",
            padding: "25px",
          }}
        >

          <h2
            style={{
              marginTop: 0,
            }}
          >
            📄 Upload Learning Material
          </h2>

          <p
            style={{
              color: "#aaa",
              marginBottom: "20px",
            }}
          >
            Supported formats:
            PDF and DOCX
          </p>

          <input
            type="file"
            accept=".pdf,.docx"
            onChange={(e) => {
              setFile(
                e.target.files?.[0] ||
                  null
              );
            }}
            style={{
              width: "100%",
              padding: "12px",
              background: "#252733",
              color: "#fff",
              borderRadius: "8px",
              border:
                "1px solid #444",
            }}
          />

          {/* LANGUAGE */}

          <div
            style={{
              marginTop: "22px",
            }}
          >

            <label>
              <strong>
                🌐 Reading Language
              </strong>
            </label>

            <select
              value={language}
              onChange={
                handleLanguageChange
              }
              style={{
                display: "block",
                marginTop: "10px",
                padding: "12px",
                width: "100%",
                maxWidth: "350px",
                background: "#252733",
                color: "#fff",
                border:
                  "1px solid #555",
                borderRadius: "8px",
              }}
            >

              <option value="english">
                English
              </option>

              <option value="tamil">
                தமிழ் (Tamil)
              </option>

              <option value="hindi">
                हिन्दी (Hindi)
              </option>

              <option value="telugu">
                తెలుగు (Telugu)
              </option>

              <option value="malayalam">
                മലയാളം (Malayalam)
              </option>

              <option value="kannada">
                ಕನ್ನಡ (Kannada)
              </option>

            </select>

          </div>


          {/* UPLOAD BUTTON */}

          <button
            onClick={
              handleUpload
            }
            disabled={
              uploading ||
              analyzing ||
              translating
            }
            style={{
              marginTop: "25px",
              padding:
                "14px 28px",
              fontSize: "16px",
              fontWeight: "bold",
              border: "none",
              borderRadius: "9px",
              background:
                uploading ||
                analyzing ||
                translating
                  ? "#555"
                  : "#6c63ff",
              color: "#fff",
              cursor:
                uploading ||
                analyzing ||
                translating
                  ? "not-allowed"
                  : "pointer",
            }}
          >

            {uploading
              ? "📤 Uploading..."
              : analyzing
              ? "🧠 AI Analyzing..."
              : translating
              ? "🌐 Translating..."
              : "🚀 Analyze Document"}

          </button>

        </div>


        {/* ================================================= */}
        {/* STATUS */}
        {/* ================================================= */}

        {uploading && (
          <StatusBox>
            📄 Uploading and
            extracting document...
          </StatusBox>
        )}

        {analyzing && (
          <StatusBox>
            🧠 AI is analyzing your
            document...
            <br />
            <small>
              Creating bilingual
              summary, concepts,
              vocabulary and questions.
            </small>
          </StatusBox>
        )}

        {translating && (
          <StatusBox>
            🌐 Translating document
            to{" "}
            <strong>
              {targetLanguageName}
            </strong>
            ...
          </StatusBox>
        )}


        {/* ================================================= */}
        {/* ERROR */}
        {/* ================================================= */}

        {error && (
          <div
            style={{
              marginTop: "20px",
              padding: "18px",
              background: "#4a1f24",
              color: "#ffb8bf",
              border:
                "1px solid #8c3c45",
              borderRadius: "10px",
            }}
          >

            <strong>
              ❌ Error
            </strong>

            <div
              style={{
                marginTop: "8px",
              }}
            >
              {error}
            </div>

          </div>
        )}


        {/* ================================================= */}
        {/* DOCUMENT INFO */}
        {/* ================================================= */}

        {result && (
          <div
            style={{
              marginTop: "30px",
              padding: "22px",
              background: "#1b1d27",
              border:
                "1px solid #303341",
              borderRadius: "12px",
            }}
          >

            <h2>
              📄 {result.filename}
            </h2>

            <div
              style={{
                display: "flex",
                gap: "30px",
                flexWrap: "wrap",
                color: "#bbb",
              }}
            >

              <span>
                <strong>
                  Pages:
                </strong>{" "}
                {result.page_count}
              </span>

              <span>
                <strong>
                  Characters:
                </strong>{" "}
                {result.character_count}
              </span>

              <span>
                <strong>
                  Language:
                </strong>{" "}
                {targetLanguageName}
              </span>

            </div>

          </div>
        )}


        {/* ================================================= */}
        {/* AI SUMMARY */}
        {/* ================================================= */}

        {analysis?.summary && (
          <section
            style={{
              marginTop: "35px",
            }}
          >

            <h2
              style={sectionTitle}
            >
              🧠 AI Summary
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "20px",
              }}
            >

              {/* ENGLISH */}

              <LanguageCard
                title="🇬🇧 English"
              >

                <h3>
                  {
                    analysis.summary
                      .title_en
                  }
                </h3>

                <p>
                  {
                    analysis.summary
                      .overview_en
                  }
                </p>

                <h4>
                  Key Points
                </h4>

                <ul>

                  {analysis.summary
                    .key_points
                    ?.map(
                      (
                        point,
                        index
                      ) => (
                        <li
                          key={index}
                          style={{
                            marginBottom:
                              "10px",
                          }}
                        >
                          {point.en}
                        </li>
                      )
                    )}

                </ul>

              </LanguageCard>


              {/* TARGET */}

              <LanguageCard
                title={`🌐 ${targetLanguageName}`}
              >

                <h3>
                  {
                    analysis.summary
                      .title_target
                  }
                </h3>

                <p>
                  {
                    analysis.summary
                      .overview_target
                  }
                </p>

                <h4>
                  Key Points
                </h4>

                <ul>

                  {analysis.summary
                    .key_points
                    ?.map(
                      (
                        point,
                        index
                      ) => (
                        <li
                          key={index}
                          style={{
                            marginBottom:
                              "10px",
                          }}
                        >
                          {point.target}
                        </li>
                      )
                    )}

                </ul>

              </LanguageCard>

            </div>

          </section>
        )}


        {/* ================================================= */}
        {/* KEY CONCEPTS */}
        {/* ================================================= */}

        {analysis?.concepts
          ?.length > 0 && (
          <section
            style={{
              marginTop: "40px",
            }}
          >

            <h2
              style={sectionTitle}
            >
              🔑 Key Concepts
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "20px",
              }}
            >

              {analysis.concepts.map(
                (
                  concept,
                  index
                ) => (

                  <div
                    key={index}
                    style={{
                      background:
                        "#1b1d27",
                      border:
                        "1px solid #303341",
                      borderRadius:
                        "14px",
                      padding:
                        "22px",
                    }}
                  >

                    <div
                      style={{
                        color:
                          "#8f88ff",
                        fontSize:
                          "14px",
                        fontWeight:
                          "bold",
                        marginBottom:
                          "8px",
                      }}
                    >
                      CONCEPT{" "}
                      {index + 1}
                    </div>

                    <h3
                      style={{
                        marginTop: 0,
                        fontSize:
                          "22px",
                      }}
                    >
                      {
                        concept.name_en
                      }
                    </h3>

                    <p
                      style={{
                        lineHeight:
                          "1.7",
                        color:
                          "#ddd",
                      }}
                    >
                      {
                        concept.explanation_en
                      }
                    </p>

                    <div
                      style={{
                        marginTop:
                          "18px",
                        padding:
                          "15px",
                        background:
                          "#252733",
                        borderRadius:
                          "10px",
                      }}
                    >

                      <strong>
                        Why it matters:
                      </strong>

                      <p
                        style={{
                          marginBottom:
                            0,
                          lineHeight:
                            "1.6",
                        }}
                      >
                        {
                          concept.importance_en
                        }
                      </p>

                    </div>


                    {/* TARGET */}

                    {language !==
                      "english" && (
                      <>

                        <hr
                          style={{
                            border:
                              "none",
                            borderTop:
                              "1px solid #383a48",
                            margin:
                              "22px 0",
                          }}
                        />

                        <div
                          style={{
                            color:
                              "#7dd3fc",
                            fontSize:
                              "14px",
                            fontWeight:
                              "bold",
                          }}
                        >
                          {
                            targetLanguageName
                          }
                        </div>

                        <h3>
                          {
                            concept.name_target
                          }
                        </h3>

                        <p
                          style={{
                            lineHeight:
                              "1.7",
                            color:
                              "#ddd",
                          }}
                        >
                          {
                            concept.explanation_target
                          }
                        </p>

                        <div
                          style={{
                            marginTop:
                              "18px",
                            padding:
                              "15px",
                            background:
                              "#252733",
                            borderRadius:
                              "10px",
                          }}
                        >

                          <strong>
                            Why it
                            matters:
                          </strong>

                          <p
                            style={{
                              marginBottom:
                                0,
                              lineHeight:
                                "1.6",
                            }}
                          >
                            {
                              concept.importance_target
                            }
                          </p>

                        </div>

                      </>
                    )}


                    <div
                      style={{
                        marginTop:
                          "18px",
                        color:
                          "#aaa",
                        fontSize:
                          "14px",
                      }}
                    >
                      📄 Page{" "}
                      {
                        concept.page
                      }
                    </div>

                  </div>

                )
              )}

            </div>

          </section>
        )}


        {/* ================================================= */}
        {/* DIFFICULT VOCABULARY */}
        {/* ================================================= */}

        {analysis?.vocabulary
          ?.length > 0 && (
          <section
            style={{
              marginTop: "40px",
            }}
          >

            <h2
              style={sectionTitle}
            >
              📚 Difficult Vocabulary
            </h2>

            <p
              style={{
                color: "#aaa",
                marginBottom:
                  "20px",
              }}
            >
              Words and phrases
              that may be
              difficult to
              understand or
              remember.
            </p>

            <div
              style={{
                display: "grid",
                gap: "20px",
              }}
            >

              {analysis.vocabulary.map(
                (
                  item,
                  index
                ) => (

                  <div
                    key={index}
                    style={{
                      background:
                        "#1b1d27",
                      border:
                        "1px solid #303341",
                      borderRadius:
                        "14px",
                      padding:
                        "22px",
                    }}
                  >

                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        gap: "15px",
                        flexWrap:
                          "wrap",
                      }}
                    >

                      <h3
                        style={{
                          margin: 0,
                          color:
                            "#facc15",
                        }}
                      >
                        {
                          item.term_en
                        }
                      </h3>

                      <span
                        style={{
                          color:
                            "#aaa",
                          fontSize:
                            "14px",
                        }}
                      >
                        📄 Page{" "}
                        {
                          item.page
                        }
                      </span>

                    </div>


                    <div
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(280px, 1fr))",
                        gap: "15px",
                        marginTop:
                          "20px",
                      }}
                    >

                      <InfoBox
                        title="🇬🇧 English Meaning"
                      >
                        {
                          item.meaning_en
                        }
                      </InfoBox>

                      <InfoBox
                        title={`🌐 ${targetLanguageName} Meaning`}
                      >
                        {
                          item.meaning_target
                        }
                      </InfoBox>

                      <InfoBox
                        title="📖 English Context"
                      >
                        {
                          item.context_en
                        }
                      </InfoBox>

                      <InfoBox
                        title={`📖 ${targetLanguageName} Context`}
                      >
                        {
                          item.context_target
                        }
                      </InfoBox>

                      <InfoBox
                        title="💡 English Example"
                      >
                        {
                          item.example_en
                        }
                      </InfoBox>

                      <InfoBox
                        title={`💡 ${targetLanguageName} Example`}
                      >
                        {
                          item.example_target
                        }
                      </InfoBox>

                    </div>

                  </div>

                )
              )}

            </div>

          </section>
        )}


        {/* ================================================= */}
        {/* QUESTIONS */}
        {/* ================================================= */}

        {analysis?.questions
          ?.length > 0 && (
          <section
            style={{
              marginTop: "40px",
            }}
          >

            <h2
              style={sectionTitle}
            >
              ❓ Questions Found in
              Document
            </h2>

            <div
              style={{
                display: "grid",
                gap: "16px",
              }}
            >

              {analysis.questions.map(
                (
                  question,
                  index
                ) => (

                  <div
                    key={index}
                    style={{
                      background:
                        "#211f17",
                      border:
                        "1px solid #6d5b25",
                      borderRadius:
                        "12px",
                      padding:
                        "20px",
                    }}
                  >

                    <div
                      style={{
                        color:
                          "#facc15",
                        fontWeight:
                          "bold",
                        marginBottom:
                          "10px",
                      }}
                    >
                      Question{" "}
                      {index + 1}
                    </div>

                    <p
                      style={{
                        fontSize:
                          "17px",
                        lineHeight:
                          "1.6",
                      }}
                    >

                      <strong>
                        🇬🇧 English:
                      </strong>

                      <br />

                      {
                        question.question_en
                      }

                    </p>


                    {language !==
                      "english" && (
                      <p
                        style={{
                          fontSize:
                            "17px",
                          lineHeight:
                            "1.6",
                        }}
                      >

                        <strong>
                          🌐{" "}
                          {
                            targetLanguageName
                          }:
                        </strong>

                        <br />

                        {
                          question.question_target
                        }

                      </p>
                    )}


                    <small
                      style={{
                        color:
                          "#aaa",
                      }}
                    >
                      📄 Page{" "}
                      {
                        question.page
                      }
                    </small>

                  </div>

                )
              )}

            </div>

          </section>
        )}


        {/* ================================================= */}
        {/* QUIZ */}
        {/* ================================================= */}

        {analysis && (
          <section
            style={{
              marginTop: "45px",
            }}
          >

            <h2
              style={sectionTitle}
            >
              📝 Test Your
              Understanding
            </h2>


            {/* QUIZ SETUP */}

            {!quiz && (
              <div
                style={{
                  background:
                    "#1b1d27",
                  border:
                    "1px solid #303341",
                  borderRadius:
                    "16px",
                  padding:
                    "25px",
                }}
              >

                <p
                  style={{
                    color:
                      "#aaa",
                    lineHeight:
                      "1.7",
                    marginTop: 0,
                  }}
                >
                  Test your
                  understanding of
                  the concepts
                  extracted from
                  this document.
                </p>

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "18px",
                    marginTop:
                      "20px",
                  }}
                >

                  {/* DIFFICULTY */}

                  <div>

                    <label
                      style={{
                        display:
                          "block",
                        marginBottom:
                          "8px",
                        fontWeight:
                          "bold",
                      }}
                    >
                      Difficulty
                    </label>

                    <select
                      value={
                        quizDifficulty
                      }
                      onChange={(e) =>
                        setQuizDifficulty(
                          e.target.value
                        )
                      }
                      disabled={
                        quizLoading
                      }
                      style={{
                        width:
                          "100%",
                        padding:
                          "12px",
                        background:
                          "#252733",
                        color:
                          "#fff",
                        border:
                          "1px solid #555",
                        borderRadius:
                          "8px",
                      }}
                    >

                      <option value="easy">
                        Easy
                      </option>

                      <option value="medium">
                        Medium
                      </option>

                      <option value="hard">
                        Hard
                      </option>

                    </select>

                  </div>


                  {/* QUESTION COUNT */}

                  <div>

                    <label
                      style={{
                        display:
                          "block",
                        marginBottom:
                          "8px",
                        fontWeight:
                          "bold",
                      }}
                    >
                      Number of
                      Questions
                    </label>

                    <select
                      value={
                        quizQuestionCount
                      }
                      onChange={(e) =>
                        setQuizQuestionCount(
                          Number(
                            e.target.value
                          )
                        )
                      }
                      disabled={
                        quizLoading
                      }
                      style={{
                        width:
                          "100%",
                        padding:
                          "12px",
                        background:
                          "#252733",
                        color:
                          "#fff",
                        border:
                          "1px solid #555",
                        borderRadius:
                          "8px",
                      }}
                    >

                      <option value={5}>
                        5 Questions
                      </option>

                      <option value={10}>
                        10 Questions
                      </option>

                      <option value={15}>
                        15 Questions
                      </option>

                      <option value={20}>
                        20 Questions
                      </option>

                    </select>

                  </div>

                </div>


                <button
                  onClick={
                    generateQuiz
                  }
                  disabled={
                    quizLoading
                  }
                  style={{
                    marginTop:
                      "22px",
                    padding:
                      "14px 28px",
                    fontSize:
                      "16px",
                    fontWeight:
                      "bold",
                    border:
                      "none",
                    borderRadius:
                      "9px",
                    background:
                      quizLoading
                        ? "#555"
                        : "#6c63ff",
                    color:
                      "#fff",
                    cursor:
                      quizLoading
                        ? "not-allowed"
                        : "pointer",
                  }}
                >

                  {quizLoading
                    ? "🧠 Generating Quiz..."
                    : "🚀 Start Quiz"}

                </button>


                {quizLoading && (
                  <p
                    style={{
                      color:
                        "#aaa",
                      marginBottom:
                        0,
                      marginTop:
                        "14px",
                    }}
                  >
                    AI is creating
                    questions from
                    your document.
                    This may take a
                    moment.
                  </p>
                )}

              </div>
            )}


            {/* ACTIVE QUIZ */}

            {quiz &&
              !quizCompleted && (
                <div
                  style={{
                    background:
                      "#1b1d27",
                    border:
                      "1px solid #303341",
                    borderRadius:
                      "16px",
                    padding:
                      "28px",
                  }}
                >

                  {(() => {
                    const question =
                      quiz.questions[
                        currentQuestion
                      ];

                    if (!question) {
                      return (
                        <p>
                          No question
                          is available.
                        </p>
                      );
                    }

                    return (
                      <>

                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            alignItems:
                              "center",
                            gap:
                              "15px",
                            flexWrap:
                              "wrap",
                            marginBottom:
                              "22px",
                          }}
                        >

                          <span
                            style={{
                              color:
                                "#8f88ff",
                              fontWeight:
                                "bold",
                            }}
                          >
                            Question{" "}
                            {currentQuestion +
                              1}{" "}
                            /{" "}
                            {
                              quiz
                                .questions
                                .length
                            }
                          </span>

                          <span
                            style={{
                              padding:
                                "7px 12px",
                              borderRadius:
                                "20px",
                              background:
                                "#252733",
                              color:
                                "#bbb",
                              fontSize:
                                "14px",
                            }}
                          >
                            {
                              quizDifficulty.toUpperCase()
                            }
                          </span>

                        </div>


                        <h3
                          style={{
                            fontSize:
                              "22px",
                            lineHeight:
                              "1.5",
                            marginTop:
                              0,
                          }}
                        >
                          {
                            question.question_en
                          }
                        </h3>


                        {language !==
                          "english" &&
                          question.question_target && (
                            <div
                              style={{
                                marginTop:
                                  "15px",
                                marginBottom:
                                  "20px",
                                padding:
                                  "15px",
                                background:
                                  "#252733",
                                borderRadius:
                                  "10px",
                                color:
                                  "#ddd",
                                lineHeight:
                                  "1.7",
                              }}
                            >

                              <strong>
                                🌐{" "}
                                {
                                  targetLanguageName
                                }
                              </strong>

                              <div
                                style={{
                                  marginTop:
                                    "8px",
                                }}
                              >
                                {
                                  question.question_target
                                }
                              </div>

                            </div>
                          )}


                        {/* OPTIONS */}

                        <div
                          style={{
                            display:
                              "grid",
                            gap:
                              "12px",
                          }}
                        >

                          {(
                            question.options ||
                            []
                          ).map(
                            (
                              option
                            ) => {

                              const isSelected =
                                selectedAnswer ===
                                option.id;

                              return (
                                <button
                                  key={
                                    option.id
                                  }
                                  onClick={() =>
                                    handleQuizAnswer(
                                      option.id
                                    )
                                  }
                                  style={{
                                    width:
                                      "100%",
                                    textAlign:
                                      "left",
                                    padding:
                                      "16px 18px",
                                    background:
                                      isSelected
                                        ? "#302b66"
                                        : "#252733",
                                    color:
                                      "#fff",
                                    border:
                                      isSelected
                                        ? "2px solid #8f88ff"
                                        : "1px solid #444",
                                    borderRadius:
                                      "10px",
                                    cursor:
                                      "pointer",
                                    fontSize:
                                      "16px",
                                    lineHeight:
                                      "1.5",
                                  }}
                                >

                                  <strong
                                    style={{
                                      display:
                                        "inline-block",
                                      width:
                                        "28px",
                                      color:
                                        "#8f88ff",
                                    }}
                                  >
                                    {
                                      option.id
                                    }.
                                  </strong>

                                  {
                                    option.text
                                  }

                                </button>
                              );
                            }
                          )}

                        </div>


                        {/* NEXT */}

                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            alignItems:
                              "center",
                            gap:
                              "15px",
                            marginTop:
                              "25px",
                            flexWrap:
                              "wrap",
                          }}
                        >

                          <span
                            style={{
                              color:
                                "#999",
                              fontSize:
                                "14px",
                            }}
                          >
                            {selectedAnswer
                              ? "Answer selected"
                              : "Select an answer"}
                          </span>

                          <button
                            onClick={
                              handleNextQuestion
                            }
                            disabled={
                              selectedAnswer ===
                              null
                            }
                            style={{
                              padding:
                                "13px 25px",
                              border:
                                "none",
                              borderRadius:
                                "9px",
                              background:
                                selectedAnswer ===
                                null
                                  ? "#444"
                                  : "#6c63ff",
                              color:
                                "#fff",
                              fontWeight:
                                "bold",
                              cursor:
                                selectedAnswer ===
                                null
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >

                            {currentQuestion ===
                              quiz.questions
                                .length -
                                1
                              ? "Finish Quiz"
                              : "Next Question →"}

                          </button>

                        </div>


                        {question.page && (
                          <div
                            style={{
                              marginTop:
                                "18px",
                              color:
                                "#888",
                              fontSize:
                                "13px",
                            }}
                          >
                            📄 Based on
                            page{" "}
                            {
                              question.page
                            }
                          </div>
                        )}

                      </>
                    );
                  })()}

                </div>
              )}


            {/* QUIZ RESULT */}

            {quiz &&
              quizCompleted && (
                <div
                  style={{
                    background:
                      "#1b1d27",
                    border:
                      "1px solid #303341",
                    borderRadius:
                      "16px",
                    padding:
                      "30px",
                    textAlign:
                      "center",
                  }}
                >

                  <div
                    style={{
                      fontSize:
                        "52px",
                      marginBottom:
                        "10px",
                    }}
                  >
                    🎯
                  </div>

                  <h3
                    style={{
                      fontSize:
                        "28px",
                      marginTop:
                        0,
                    }}
                  >
                    Quiz Completed
                  </h3>

                  <p
                    style={{
                      fontSize:
                        "20px",
                      color:
                        "#ddd",
                    }}
                  >
                    Your Score
                  </p>

                  <div
                    style={{
                      fontSize:
                        "44px",
                      fontWeight:
                        "bold",
                      color:
                        "#8f88ff",
                      margin:
                        "10px 0",
                    }}
                  >
                    {quizScore} /{" "}
                    {
                      quiz.questions
                        .length
                    }
                  </div>

                  <p
                    style={{
                      color:
                        "#aaa",
                      fontSize:
                        "16px",
                    }}
                  >
                    Accuracy:{" "}
                    {quiz.questions
                      .length > 0
                      ? Math.round(
                          (quizScore /
                            quiz.questions
                              .length) *
                            100
                        )
                      : 0}
                    %
                  </p>


                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "center",
                      gap:
                        "12px",
                      flexWrap:
                        "wrap",
                      marginTop:
                        "25px",
                    }}
                  >

                    <button
                      onClick={
                        restartQuiz
                      }
                      style={{
                        padding:
                          "12px 22px",
                        border:
                          "1px solid #555",
                        borderRadius:
                          "9px",
                        background:
                          "#252733",
                        color:
                          "#fff",
                        fontWeight:
                          "bold",
                        cursor:
                          "pointer",
                      }}
                    >
                      🔄 Review Quiz
                    </button>

                    <button
                      onClick={
                        generateQuiz
                      }
                      disabled={
                        quizLoading
                      }
                      style={{
                        padding:
                          "12px 22px",
                        border:
                          "none",
                        borderRadius:
                          "9px",
                        background:
                          "#6c63ff",
                        color:
                          "#fff",
                        fontWeight:
                          "bold",
                        cursor:
                          "pointer",
                      }}
                    >
                      {quizLoading
                        ? "Generating..."
                        : "✨ Generate New Quiz"}
                    </button>

                    <button
                      onClick={
                        closeQuiz
                      }
                      style={{
                        padding:
                          "12px 22px",
                        border:
                          "1px solid #555",
                        borderRadius:
                          "9px",
                        background:
                          "transparent",
                        color:
                          "#ccc",
                        fontWeight:
                          "bold",
                        cursor:
                          "pointer",
                      }}
                    >
                      Close
                    </button>

                  </div>

                </div>
              )}

          </section>
        )}


        {/* ================================================= */}
        {/* ASK A2Z */}
        {/* ================================================= */}

        <section
          style={{
            marginTop: "45px",
          }}
        >

          <h2
            style={sectionTitle}
          >
            🤖 Ask A2Z
          </h2>

          <div
            style={{
              background:
                "linear-gradient(135deg, #1b1d27, #22243a)",
              border:
                "1px solid #3b3e50",
              borderRadius:
                "18px",
              padding:
                "28px",
            }}
          >

            <p
              style={{
                color: "#aaa",
                lineHeight:
                  "1.7",
                marginTop: 0,
              }}
            >
              Ask questions about
              your uploaded document.
              Ask A2Z answers using
              the document content
              and shows the source
              page.
            </p>


            {/* QUICK QUESTIONS */}

            {result && (
              <div
                style={{
                  display:
                    "flex",
                  gap: "8px",
                  flexWrap:
                    "wrap",
                  marginBottom:
                    "15px",
                }}
              >

                {[
                  "What is the main concept of this document?",
                  "Explain the important concepts simply.",
                  "What are the key points I should remember?",
                ].map(
                  (
                    question,
                    index
                  ) => (
                    <button
                      key={index}
                      onClick={() =>
                        setChatQuestion(
                          question
                        )
                      }
                      disabled={
                        chatLoading
                      }
                      style={{
                        padding:
                          "8px 12px",
                        background:
                          "#252733",
                        color:
                          "#bbb",
                        border:
                          "1px solid #444",
                        borderRadius:
                          "20px",
                        cursor:
                          "pointer",
                        fontSize:
                          "13px",
                      }}
                    >
                      {question}
                    </button>
                  )
                )}

              </div>
            )}


            {/* QUESTION INPUT */}

            <textarea
              value={
                chatQuestion
              }
              onChange={(e) =>
                setChatQuestion(
                  e.target.value
                )
              }
              placeholder="Ask something about this document..."
              rows={4}
              disabled={
                chatLoading
              }
              style={{
                width:
                  "100%",
                boxSizing:
                  "border-box",
                padding:
                  "15px",
                background:
                  "#252733",
                color:
                  "#fff",
                border:
                  "1px solid #555",
                borderRadius:
                  "10px",
                resize:
                  "vertical",
                fontSize:
                  "16px",
                lineHeight:
                  "1.5",
                outline:
                  "none",
              }}
            />


            {/* ASK BUTTON */}

            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                marginTop:
                  "15px",
                gap:
                  "15px",
              }}
            >

              <span
                style={{
                  color:
                    "#777",
                  fontSize:
                    "13px",
                }}
              >
                🌐 Answer:
                {" "}
                {targetLanguageName}
              </span>

              <button
                onClick={
                  askA2Z
                }
                disabled={
                  chatLoading ||
                  !chatQuestion.trim() ||
                  !result?.pages?.length
                }
                style={{
                  padding:
                    "13px 25px",
                  border:
                    "none",
                  borderRadius:
                    "9px",
                  background:
                    chatLoading ||
                    !chatQuestion.trim() ||
                    !result?.pages?.length
                      ? "#444"
                      : "#6c63ff",
                  color:
                    "#fff",
                  fontWeight:
                    "bold",
                  fontSize:
                    "15px",
                  cursor:
                    chatLoading ||
                    !chatQuestion.trim() ||
                    !result?.pages?.length
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {chatLoading
                  ? "🧠 Thinking..."
                  : "🤖 Ask A2Z"}
              </button>

            </div>


            {/* ERROR */}

            {chatError && (
              <div
                style={{
                  marginTop:
                    "18px",
                  padding:
                    "15px",
                  background:
                    "#4a1f24",
                  color:
                    "#ffb8bf",
                  border:
                    "1px solid #8c3c45",
                  borderRadius:
                    "10px",
                }}
              >
                ❌ {chatError}
              </div>
            )}


            {/* ANSWER */}

            {chatAnswer && (
              <div
                style={{
                  marginTop:
                    "25px",
                  background:
                    "#252733",
                  border:
                    "1px solid #3b3e50",
                  borderRadius:
                    "14px",
                  padding:
                    "22px",
                }}
              >

                <div
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap:
                      "10px",
                    marginBottom:
                      "20px",
                  }}
                >

                  <span
                    style={{
                      fontSize:
                        "25px",
                    }}
                  >
                    🤖
                  </span>

                  <h3
                    style={{
                      margin: 0,
                      color:
                        "#8f88ff",
                    }}
                  >
                    Ask A2Z Answer
                  </h3>

                </div>


                {/* ENGLISH */}

                <div
                  style={{
                    marginBottom:
                      "22px",
                  }}
                >

                  <div
                    style={{
                      color:
                        "#8f88ff",
                      fontWeight:
                        "bold",
                      marginBottom:
                        "8px",
                    }}
                  >
                    🇬🇧 English
                  </div>

                  <p
                    style={{
                      margin: 0,
                      color:
                        "#eee",
                      lineHeight:
                        "1.8",
                      whiteSpace:
                        "pre-wrap",
                    }}
                  >
                    {
                      chatAnswer.answer_en
                    }
                  </p>

                </div>


                {/* TARGET LANGUAGE */}

                {language !==
                  "english" && (
                  <div
                    style={{
                      paddingTop:
                        "20px",
                      borderTop:
                        "1px solid #3b3e50",
                      marginBottom:
                        "20px",
                    }}
                  >

                    <div
                      style={{
                        color:
                          "#7dd3fc",
                        fontWeight:
                          "bold",
                        marginBottom:
                          "8px",
                      }}
                    >
                      🌐{" "}
                      {
                        targetLanguageName
                      }
                    </div>

                    <p
                      style={{
                        margin: 0,
                        color:
                          "#eee",
                        lineHeight:
                          "1.8",
                        whiteSpace:
                          "pre-wrap",
                      }}
                    >
                      {
                        chatAnswer.answer_target
                      }
                    </p>

                  </div>
                )}


                {/* SOURCES */}

                {chatAnswer.sources &&
                  chatAnswer.sources
                    .length > 0 && (

                  <div
                    style={{
                      paddingTop:
                        "18px",
                      borderTop:
                        "1px solid #3b3e50",
                    }}
                  >

                    <div
                      style={{
                        color:
                          "#aaa",
                        fontWeight:
                          "bold",
                        marginBottom:
                          "10px",
                      }}
                    >
                      📄 Source Pages
                    </div>

                    <div
                      style={{
                        display:
                          "flex",
                        gap:
                          "8px",
                        flexWrap:
                          "wrap",
                      }}
                    >

                      {chatAnswer.sources.map(
                        (
                          source,
                          index
                        ) => (
                          <span
                            key={
                              index
                            }
                            style={{
                              padding:
                                "7px 12px",
                              background:
                                "#302b66",
                              color:
                                "#c4b5fd",
                              borderRadius:
                                "20px",
                              fontSize:
                                "13px",
                            }}
                          >
                            Page{" "}
                            {
                              source.page
                            }
                          </span>
                        )
                      )}

                    </div>

                  </div>

                )}

              </div>
            )}

          </div>

        </section>


        {/* ================================================= */}
        {/* DOWNLOAD DOCUMENT */}
        {/* ================================================= */}

        {result &&
          displayText && (

          <section
            style={{
              marginTop:
                "45px",
            }}
          >

            <h2
              style={sectionTitle}
            >
              📥 Download Your
              Learning Document
            </h2>

            <div
              style={{
                position:
                  "relative",
                overflow:
                  "hidden",
                background:
                  "linear-gradient(135deg, #1b1d27, #252842)",
                border:
                  "1px solid #3b3e50",
                borderRadius:
                  "18px",
                padding:
                  "30px",
              }}
            >

              {/* DECORATIVE GLOW */}

              <div
                style={{
                  position:
                    "absolute",
                  width:
                    "200px",
                  height:
                    "200px",
                  borderRadius:
                    "50%",
                  background:
                    "rgba(108, 99, 255, 0.12)",
                  right:
                    "-70px",
                  top:
                    "-90px",
                  pointerEvents:
                    "none",
                }}
              />

              <div
                style={{
                  position:
                    "relative",
                  zIndex: 1,
                }}
              >

                {/* HEADER */}

                <div
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap:
                      "15px",
                  }}
                >

                  <div
                    style={{
                      width:
                        "55px",
                      height:
                        "55px",
                      borderRadius:
                        "15px",
                      background:
                        "#302b66",
                      display:
                        "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      fontSize:
                        "27px",
                    }}
                  >
                    🌐
                  </div>

                  <div>

                    <h3
                      style={{
                        margin:
                          0,
                        fontSize:
                          "22px",
                      }}
                    >
                      Your document
                      is ready
                    </h3>

                    <p
                      style={{
                        margin:
                          "5px 0 0",
                        color:
                          "#aaa",
                      }}
                    >
                      Download it in{" "}
                      <strong
                        style={{
                          color:
                            "#8f88ff",
                        }}
                      >
                        {
                          targetLanguageName
                        }
                      </strong>
                    </p>

                  </div>

                </div>


                {/* FORMAT CARDS */}

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(240px, 1fr))",
                    gap:
                      "16px",
                    marginTop:
                      "25px",
                  }}
                >

                  {/* DOCX */}

                  <button
                    onClick={() =>
                      downloadDocument(
                        "docx"
                      )
                    }
                    disabled={
                      downloading !==
                      ""
                    }
                    style={{
                      padding:
                        "22px",
                      background:
                        "#1b1d27",
                      color:
                        "#fff",
                      border:
                        "1px solid #444",
                      borderRadius:
                        "14px",
                      cursor:
                        downloading
                          ? "not-allowed"
                          : "pointer",
                      textAlign:
                        "left",
                      opacity:
                        downloading &&
                        downloading !==
                          "docx"
                          ? 0.5
                          : 1,
                    }}
                  >

                    <div
                      style={{
                        fontSize:
                          "32px",
                      }}
                    >
                      📝
                    </div>

                    <h3
                      style={{
                        margin:
                          "12px 0 5px",
                      }}
                    >
                      Word Document
                    </h3>

                    <p
                      style={{
                        margin:
                          0,
                        color:
                          "#999",
                        fontSize:
                          "14px",
                      }}
                    >
                      Editable DOCX file
                    </p>

                    <div
                      style={{
                        marginTop:
                          "16px",
                        color:
                          "#8f88ff",
                        fontWeight:
                          "bold",
                      }}
                    >
                      {downloading ===
                      "docx"
                        ? "⏳ Preparing..."
                        : "Download DOCX →"}
                    </div>

                  </button>


                  {/* PDF */}

                  <button
                    onClick={() =>
                      downloadDocument(
                        "pdf"
                      )
                    }
                    disabled={
                      downloading !==
                      ""
                    }
                    style={{
                      padding:
                        "22px",
                      background:
                        "#1b1d27",
                      color:
                        "#fff",
                      border:
                        "1px solid #444",
                      borderRadius:
                        "14px",
                      cursor:
                        downloading
                          ? "not-allowed"
                          : "pointer",
                      textAlign:
                        "left",
                      opacity:
                        downloading &&
                        downloading !==
                          "pdf"
                          ? 0.5
                          : 1,
                    }}
                  >

                    <div
                      style={{
                        fontSize:
                          "32px",
                      }}
                    >
                      📄
                    </div>

                    <h3
                      style={{
                        margin:
                          "12px 0 5px",
                      }}
                    >
                      PDF Document
                    </h3>

                    <p
                      style={{
                        margin:
                          0,
                        color:
                          "#999",
                        fontSize:
                          "14px",
                      }}
                    >
                      Print-ready PDF file
                    </p>

                    <div
                      style={{
                        marginTop:
                          "16px",
                        color:
                          "#8f88ff",
                        fontWeight:
                          "bold",
                      }}
                    >
                      {downloading ===
                      "pdf"
                        ? "⏳ Preparing..."
                        : "Download PDF →"}
                    </div>

                  </button>

                </div>


                {/* ERROR */}

                {downloadError && (
                  <div
                    style={{
                      marginTop:
                        "18px",
                      padding:
                        "13px 16px",
                      background:
                        "#4a1f24",
                      color:
                        "#ffb8bf",
                      border:
                        "1px solid #8c3c45",
                      borderRadius:
                        "10px",
                    }}
                  >
                    ❌{" "}
                    {downloadError}
                  </div>
                )}

              </div>

            </div>

          </section>

        )}


        {/* ================================================= */}
        {/* DOCUMENT TEXT */}
        {/* ================================================= */}

        {result &&
          displayText && (
            <section
              style={{
                marginTop:
                  "40px",
              }}
            >

              <h2
                style={sectionTitle}
              >
                📖 Document Content
              </h2>

              <div
                style={{
                  padding:
                    "25px",
                  border:
                    "1px solid #303341",
                  borderRadius:
                    "14px",
                  background:
                    "#1b1d27",
                  lineHeight:
                    "1.8",
                  fontSize:
                    "17px",
                  whiteSpace:
                    "pre-wrap",
                  color:
                    "#ddd",
                }}
              >
                {displayText}
              </div>

            </section>
          )}

      </div>

    </div>
  );
}


// =============================================================
// SMALL REUSABLE COMPONENTS
// =============================================================

function StatusBox({
  children,
}) {
  return (
    <div
      style={{
        marginTop:
          "20px",
        padding:
          "16px",
        background:
          "#242633",
        border:
          "1px solid #3b3e50",
        borderRadius:
          "10px",
        color:
          "#ddd",
      }}
    >
      {children}
    </div>
  );
}


function LanguageCard({
  title,
  children,
}) {
  return (
    <div
      style={{
        background:
          "#1b1d27",
        border:
          "1px solid #303341",
        borderRadius:
          "14px",
        padding:
          "22px",
        lineHeight:
          "1.7",
      }}
    >

      <h3
        style={{
          marginTop: 0,
          color:
            "#8f88ff",
        }}
      >
        {title}
      </h3>

      {children}

    </div>
  );
}


function InfoBox({
  title,
  children,
}) {
  return (
    <div
      style={{
        background:
          "#252733",
        borderRadius:
          "10px",
        padding:
          "16px",
        lineHeight:
          "1.6",
      }}
    >

      <div
        style={{
          fontWeight:
            "bold",
          marginBottom:
            "8px",
          color:
            "#aaa",
        }}
      >
        {title}
      </div>

      <div
        style={{
          color:
            "#eee",
        }}
      >
        {children}
      </div>

    </div>
  );
}


const sectionTitle = {
  fontSize:
    "30px",
  marginBottom:
    "20px",
};


export default App;