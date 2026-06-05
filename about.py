"""Knowledge about the founder, injected directly into the AI's context.
No vector DB / embedding model needed - the profile is small enough to live in the prompt."""

FOUNDER_NAME = "Chandra Sekhar Karri"
FOUNDER_SHORT = "Chandra"

ABOUT = """
# About Chandra Sekhar Karri

Chandra Sekhar Karri is a research-focused AI engineer based in Visakhapatnam, Andhra Pradesh, India.
Contact: +91 93906 94802, karrichandu03@gmail.com.

## Summary
Research-focused AI engineer specializing in novelty detection, retrieval-augmented generation (RAG),
and NLP systems, with published research and extensive hands-on experience. Proven track record in
designing and evaluating ML/DL architectures for imbalanced classification, semantic reasoning, and
real-time intelligent systems. Strong in experimental design, ablation studies, and reproducible
evaluation, combining deep theoretical grounding with scalable engineering across the full research
lifecycle. Actively seeking research assistantship opportunities in AI/ML, NLP, and generative systems.

## Education
Bachelor of Technology, Information Technology, at Anil Neerukonda Institute of Technology and Sciences
(ANITS), Visakhapatnam. Expected graduation May 2026. CGPA 8.98 out of 10. Coursework includes Machine
Learning and AI, Deep Learning, NLP, Information Retrieval, Data Structures and Algorithms, DBMS, and
Research Methodology.

## Publications
"Deep Learning and Generative AI for Drug Discovery and Life Science," International Research Publication
Journal of Research (IRPJR), 2025 (accepted, in press). Explores GAN-driven molecular generation, virtual
screening, and multi-objective prediction of binding affinity, toxicity and solubility.

## Research Experience
Research Assistant, Department of IT, ANITS (July 2023 to October 2025), advised by Dr. Ram Prasad Reddy Sadi.
- Benchmarked classifier-resampling combinations for highly imbalanced datasets, improving minority-class F1 by 15 percent.
- Built NoveltyNet, a multi-dimensional novelty detection system using SBERT embeddings, HDBSCAN clustering,
  and cross-domain reasoning across arXiv, OpenAlex and IEEE Xplore.
- Engineered RAG document-intelligence pipelines with LangChain, FAISS and Sentence Transformers, achieving
  41 percent better retrieval relevance and 58 percent faster retrieval than keyword baselines.
- Assisted teaching ML/DL workshops for 150-plus students.

## Industry Experience
Full Stack Developer Intern, Coastal Seven Consulting, Hyderabad (May 2025 to present).
- Automated podcast publishing across Spotify, Amazon Music, Jio and Apple Music using RSS feeds and Python,
  cutting manual workload by 95 percent.
- Built GraphQL APIs with Strawberry and FastAPI, plus Google OAuth, Drive integration and secure token lifecycle.
- Helped patch critical security vulnerabilities, cutting breach risk by 40 percent.

Data Science Intern, Oasis Infobyte, Remote (June to July 2024).
- Trained Random Forest, Linear Regression and SVM models reaching 94 to 97 percent accuracy on multi-domain tasks.

## Selected Projects
- NoveltyNet: AI system for research-idea originality using semantic similarity, citation-graph reasoning and
  cross-domain knowledge transfer; curated a 50K-plus paper dataset; 32 percent interpretability gain over baselines.
- AI-Powered Voice Agent (LiveKit): real-time multilingual voice agent (English, Telugu, Tamil) with sub-second
  latency, PDF-based RAG for domain Q&A, and Google Calendar appointment booking. (This portfolio assistant is built on the same idea.)
- DocQuery: RAG document-intelligence system with a hybrid OCR pipeline (EasyOCR plus PyTesseract) and FAISS/ChromaDB.
- Genetic Algorithm Timetable Generator: conflict-free academic scheduling with genetic algorithms; 92 percent
  faster scheduling; built with Django and PostgreSQL.

## Technical Skills
Languages: Python, JavaScript, C, Java.
Frameworks: FastAPI, React, Django, LiveKit Agents SDK, LangChain, HuggingFace Transformers.
ML/DL: PyTorch, TensorFlow, Scikit-learn, XGBoost, SBERT, HDBSCAN, SMOTE, NLP, RAG pipelines.
Databases: PostgreSQL, MySQL, FAISS, ChromaDB. Tools: Git, Docker, Pandas, NumPy, OpenCV.
APIs: REST, GraphQL, OAuth 2.0, OpenAI API, Google AI Suite, Google Calendar API.

## Achievements
- Top 3, Smart India Hackathon (internal round), led a 6-member team.
- Top 3, Brainovision AR Hackathon, improved AR tracking efficiency by 22 percent.
- Finalist, Miracle Software Systems Hackathon (from 100-plus teams).
- Coding Club Lead, grew active participation by 240 percent, mentoring 80-plus students.
- Conducted ML/DL and algorithmic-trading workshops for 200 to 300-plus students.

## Research Interests
NLP, retrieval-augmented generation, novelty detection, deep learning for science, generative AI,
multimodal systems, information retrieval, imbalanced learning, research automation.
""".strip()
