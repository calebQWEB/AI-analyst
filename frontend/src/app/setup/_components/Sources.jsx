import { ChevronDown } from "lucide-react";
import { useForm } from "react-hook-form";

const Sources = ({ source, isOpen, onClick, register }) => {
  return (
    <div className="w-full">
      <div
        className={`w-2xl cursor-pointer relative bg-white rounded-xl shadow-md p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1`}
        onClick={onClick}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">{source.type}</h2>
          <ChevronDown
            className={`transition-transform duration-300 ${
              isOpen ? "rotate-180" : "rotate-0"
            }`}
          />
        </div>
      </div>

      {isOpen && (
        <form className="scale-in-ver-top mt-4 flex flex-wrap justify-start gap-4 bg-white p-4 rounded-lg shadow-inner border-gray-500 border">
          {source.name.map((item, index) => (
            <label
              key={index}
              className="flex items-center gap-2 text-gray-700 text-xl font-medium"
            >
              <input
                type="checkbox"
                {...register(item)}
                className="accent-blue-600 w-4 h-4 rounded border-gray-300 focus:ring-blue-500"
              />
              <span>{item}</span>
            </label>
          ))}
        </form>
      )}
    </div>
  );
};

export default Sources;
