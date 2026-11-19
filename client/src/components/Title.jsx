const Title = ({ title, subtitle }) => {
  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-medium text-gray-900">{title}</h1>
      <p className="mt-2 text-gray-500 max-w-xl">{subtitle}</p>
    </div>
  );
};

export default Title;
