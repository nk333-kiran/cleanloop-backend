const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: '../.env' }); // Make sure it points to the correct .env file if it's in the parent folder
// If .env is inside backend just use require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/waste", require("./routes/waste"));
app.use("/api/recycler", require("./routes/recycler"));

app.listen(process.env.PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${process.env.PORT}`);
});
