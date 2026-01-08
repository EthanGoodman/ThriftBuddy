export default async function MyNextFastAPIApp() {
  const role = await fetchEngineerRole("Backend Developer");

  if (!role) {
    return <div>Couldn’t load role.</div>;
  }

  return <div>{`The main skill of a ${role.title} is ${role.mainskill}.`}</div>;
}

async function fetchEngineerRole(title: string) {
  try {
    const response = await fetch(
      `http://localhost:8000/api/py/engineer-roles?title=${encodeURIComponent(title)}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status}`);
    }

    const data = await response.json();
    console.log("API response:", data);   // <-- check terminal
    return data;
  } catch (error) {
    console.error("Error fetching engineer role:", error);
    return null;
  }
}
