export default async function MyNextFastAPIApp() {
  const role = await fetchEngineerRole("Backend Developer");
  if (!role) return <div>Couldn’t load role.</div>;
  return <div>{`The main skill of a ${role.title} is ${role.mainskill}.`}</div>;
}

async function fetchEngineerRole(title: string) {
  const apiOrigin = process.env.FASTAPI_ORIGIN;
  if (!apiOrigin) {
    console.error("FASTAPI_ORIGIN is not set");
    return null;
  }

  try {
    const url = `${apiOrigin}/api/py/engineer-roles?title=${encodeURIComponent(title)}`;
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) throw new Error(`Failed to fetch data: ${response.status}`);

    const data = await response.json();
    console.log("API response:", data); // shows in server logs
    return data;
  } catch (error) {
    console.error("Error fetching engineer role:", error);
    return null;
  }
}
