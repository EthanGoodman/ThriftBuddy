# ThriftBuddy 🛍️🤖  
**An AI-powered resale assistant for second-hand marketplaces**

ThriftBuddy is a full-stack AI project I built to help resellers and thrifters identify items from photos and understand their resale potential. You upload images (and optional text), and ThriftBuddy combines multimodal AI, image similarity, and marketplace data to generate pricing insights and strong resale hypotheses.

This project has been *a lot* of fun to build. I made ThriftBuddy because I love thrifting and I kept running into the same problem. Google image search is great for finding out what something may be, but it doesn't give targeted resale pricing information or real demand signals. I found it mostly surfaces random listings, making it hard for me to identify resale value for items.

I wanted something that could take a photo of an item, figure out what it likely is, search marketplaces for the item, and provide me with targeted information that would help me determine whether I should buy the item. Building this system was so much fun and turned into a hands on exploration of AI pipelines, image similarity, and the messy reality of marketplace data.

---

## ✨ What ThriftBuddy Does

- 📸 **Identifies items from images**
  - Uses multimodal LLM inference to extract structured product details from photos
- 🧠 **Matches images using CLIP embeddings**
  - Compares uploaded images against marketplace listing images to improve accuracy
- 🔍 **Builds smart marketplace search queries**
  - Generates optimized queries and keyword sets for resale platforms
- 💰 **Estimates resale value**
  - Analyzes active and sold listings to surface pricing and demand signals
- 🧩 **Supports multiple images**
  - Combines visual evidence across photos instead of relying on just one

The goal isn’t “perfect identification” — it’s **strong, defensible resale insight** that helps someone decide whether an item is worth picking up.

---

## 🧠 How It Works (High-Level)

1. User uploads one or more images (plus optional text)
2. A multimodal LLM extracts structured item hypotheses and generates an initial search query
3. Marketplace listings are retrieved for that initial query
4. CLIP embeddings compare listing images to the user image(s) and select the **highest-similarity match**
5. The matched listing’s title is **cleaned** (removing fluff / irrelevant tokens) and used to **re-query** the marketplace
6. The refined results (active + sold) are analyzed to estimate resale potential

This layered approach intentionally mixes **LLM reasoning** with **embedding-based verification** to reduce hallucination and improve reliability.

---

## 🛠️ Tech Stack

### Frontend
- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS

### Backend
- FastAPI
- Python
- OpenAI API (multimodal inference)
- CLIP (image embeddings & similarity)

### Data & Infrastructure
- PostgreSQL
- Marketplace APIs (e.g., eBay via SerpAPI)
- Cloud deployment (Vercel, Render)

---


## 📂 Project Structure

```
thrift-buddy/
└── apps/
    ├── api/   # FastAPI backend (LLM + CLIP + marketplace querying)
    └── web/   # Next.js frontend (upload UI, results, insights)
```


---

## 🚧 Current Focus

ThriftBuddy is still evolving. Right now I’m focused on:
- Improving image similarity robustness
- Reducing false-positive matches
- Making pricing estimates more confidence-aware
- Exploring better ways to scale embedding computation

This project is very much a learning playground — and that’s what makes it exciting.

---

## 🎯 Why I Built This

I love building systems that sit at the intersection of **AI, software engineering, and real-world decision making**. ThriftBuddy lets me experiment with:
- Multimodal AI in a practical setting
- Combining LLMs with traditional ML techniques
- Designing systems that help humans make better calls, not replace them

It’s been one of the most enjoyable projects I’ve worked on, and I’m continuing to iterate on it as I learn more.

---

## 📄 Notes

This project is for learning, experimentation, and portfolio purposes.

---


