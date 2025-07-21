"use client";
import { dataSources } from "@/libs/constant"; // Assuming this defines your source data
import React, { useState } from "react";
import Sources from "./Sources"; // Assuming Sources component is well-styled
import { useForm } from "react-hook-form";
import { useSetup } from "@/context/SetupContext";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

const SourcePage = () => {
  const { setSelectedSources } = useSetup();
  const router = useRouter();
  const { register, handleSubmit } = useForm();

  const onSubmit = (data) => {
    const selected = Object.keys(data).filter((key) => data[key]);
    setSelectedSources(selected);
    router.push("/setup/configure");
  };

  const [openIndex, setOpenIndex] = useState(null);
  const handleToggle = (index) => {
    setOpenIndex((prevIndex) => (prevIndex === index ? null : index));
  };

  return (
    <section className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-16 font-sans antialiased">
      <div className="max-w-4xl w-full mx-auto p-8 bg-white shadow-2xl rounded-3xl border border-gray-100 text-center">
        <h1 className="text-5xl font-extrabold text-gray-900 mb-4 leading-tight">
          Connect Your Data
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          Select where your business data is stored to begin your analysis.
        </p>

        {/* Grid for data sources */}
        <div className="grid items-center justify-center gap-4 mb-8">
          {dataSources.map((source, index) => (
            <Sources
              key={index}
              source={source}
              isOpen={openIndex === index}
              onClick={() => handleToggle(index)}
              register={register}
            />
          ))}
        </div>

        <button
          onClick={handleSubmit(onSubmit)}
          className="bg-blue-600 text-white font-bold text-lg py-4 px-10 rounded-xl shadow-lg
                     hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                     transition duration-300 ease-in-out transform hover:scale-105 inline-flex items-center justify-center gap-2"
        >
          {/* Optional: Add an icon here */}
          <ArrowRight />
          Connect Selected Sources
        </button>
      </div>
    </section>
  );
};

export default SourcePage;
