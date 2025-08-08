interface CategoryChipsProps {
  categories: string[];
}

export default function CategoryChips({ categories }: CategoryChipsProps) {
  return (
    <div className="flex space-x-2 mb-8 overflow-x-auto pb-2">
      {categories.map((category) => (
        <button 
          key={category}
          className="category-chip px-4 py-2 rounded-full text-sm whitespace-nowrap"
          style={{ backgroundColor: '#282828' }}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
