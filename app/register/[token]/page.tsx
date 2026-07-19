import { getRegistrationToken } from "@/lib/auth/users";
import RegisterForm from "./RegisterForm";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const regToken = await getRegistrationToken(token);

  if (!regToken) {
    return (
      <StatusScreen
        title="Invalid Link"
        message="This registration link does not exist. Please ask an admin for a new one."
      />
    );
  }

  if (regToken.used_at) {
    return (
      <StatusScreen
        title="Link Already Used"
        message="This registration link has already been used to create an account. Please ask an admin for a new one."
      />
    );
  }

  return (
    <div className="w-full min-h-screen bg-linear-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Gembira Momento
            </h1>
            <p className="text-gray-600">Create your management account</p>
          </div>
          <RegisterForm token={token} />
        </div>
      </div>
    </div>
  );
}

function StatusScreen({ title, message }: { title: string; message: string }) {
  return (
    <div className="w-full min-h-screen bg-linear-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-2xl p-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-3">{title}</h1>
          <p className="text-gray-600">{message}</p>
        </div>
      </div>
    </div>
  );
}
