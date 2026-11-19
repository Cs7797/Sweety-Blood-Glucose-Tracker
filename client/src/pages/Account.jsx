import { useAppContext } from "../../context/appContext.jsx";
import Title from "../components/Title.jsx";

const Account = () => {
  const { user } = useAppContext();
  return (
    <>
      <Title title="Account" subtitle="Your account details." />
      <dl className="mt-6 max-w-xl border border-borderColor rounded-md p-6 space-y-5">
        <div><dt className="text-sm text-gray-500">Name</dt><dd className="mt-1 break-words">{user.name}</dd></div>
        <div><dt className="text-sm text-gray-500">Email</dt><dd className="mt-1 break-all">{user.email}</dd></div>
      </dl>
    </>
  );
};

export default Account;
