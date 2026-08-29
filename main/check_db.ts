import dotenv from "dotenv";
dotenv.config();

async function testFetch() {
  const port = process.env.PORT || 3000;
  const url = `http://localhost:${port}/api/leadership-members`;
  console.log(`Testing fetch from ${url}...`);

  try {
    const res = await fetch(url);
    console.log(`Response status: ${res.status}`);
    const data = await res.json();
    console.log(`Items returned: ${data?.length}`);
    if (Array.isArray(data) && data.length > 0) {
      console.log("Sample item:", data[0]);
    }
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

testFetch();
