"use client";
import { useState } from "react";

type docProps = {
  id: number;
  content: string;
};

export default function Home() {
  const [query, setQuery] = useState<string>("");
  const [searchResults, setsearchResults] = useState<docProps[]>();

  const documents = [
    { id: 1, content: "JavaScript is a versatile programming language." },
    {
      id: 2,
      content: "Search engines are crucial for finding information online.",
    },
    {
      id: 3,
      content: "Building a search engine involves indexing and ranking.",
    },
    {
      id: 4,
      content:
        "JavaScript can be used for both front-end and back-end development.",
    },
  ];

  function performSearch(query: string) {
    if (query == null || query.length < 3) {
      alert("enter the string greater than 3")
    }
    const res = documents.filter((doc) =>
      doc.content.toLowerCase().includes(query),
    );
    setsearchResults(res);
  }

  return (
    <div className="min-h-screen max-w-4xl mx-auto grid">
  <div className="self-center -translate-y-16  w-full flex flex-col max-w-3xl items-center">
    
    <div className="text-black">
      <input
        id="search"
        placeholder="Enter the search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button onClick={() => performSearch(query)}>
        Search
      </button>
    </div>

    <div>
      {searchResults?.length === 0 ? (
        <div>No Results</div>
      ) : (
        <ul>
          {searchResults?.map((res) => (
            <li key={res.id}>{res.content}</li>
          ))}
        </ul>
      )}
    </div>

  </div>
</div>

  );
}
