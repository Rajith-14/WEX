

const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");

const app = express();
// Assuming busNumber is passed as a parameter

// MongoDB connection
mongoose.connect("mongodb+srv://doodlebook014:Rajith014@cluster0.nnx3azi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));








// MongoDB Schemas
const busSchema = new mongoose.Schema({
  busNo: String,
  serviceNo: String,
  from: String,
  to: String,
  via: String,
  routes: [String] // Array of routes
});

const driverSchema = new mongoose.Schema({
  driverId: String,
  password: String
});

const busDriverMappingSchema = new mongoose.Schema({
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },
  busId: { type: mongoose.Schema.Types.ObjectId, ref: "Bus" },
  assignedAt: { type: Date, default: Date.now }
});


const locationDriverSchema = new mongoose.Schema({
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    required: true
  },
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    required: true
  },
  busNo: {
    type: String,
    required: true
  },
  serviceNo: {
    type: String,
    required: true
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});




// Create the models
const Bus = mongoose.model("Bus", busSchema);
const Driver = mongoose.model("Driver", driverSchema);
const BusDriverMapping = mongoose.model("BusDriverMapping", busDriverMappingSchema);
const DriverLocation = mongoose.model("LocationOfBus",locationDriverSchema)



// Step 1: Find the bus by bus number and fetch associated driver

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static("public"));
app.use(session({
  secret: "your-secret-key",
  resave: false,
  saveUninitialized: true
}));

// Set view engine to EJS for dynamic rendering
app.set('view engine', 'ejs');

// ---------------------- ROUTES ----------------------

// Serve homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Admin login
app.post("/login", (req, res) => {
  const { adminid, password } = req.body;
  if (adminid === "admin" && password === "admin") {
    res.redirect("/admin_home.html");
  } else {
    res.send("Invalid credentials");
  }
});









// Add new bus (admin)
app.post("/add-bus", async (req, res) => {
  const { busNo, serviceNo, from, to, via, routes } = req.body;
  const bus = new Bus({ busNo, serviceNo, from, to, via, routes });
  await bus.save();
  res.send("Bus added successfully. <a href='/admin_home.html'>Go back</a>");
});

// Add new driver (admin)
app.post("/add-driver", async (req, res) => {
  const { driverId, password } = req.body;
  const driver = new Driver({ driverId, password });
  await driver.save();
  res.send("Driver added successfully. <a href='/admin_home.html'>Go back</a>");
});

// Admin home page (with bus and driver details)
app.get("/admin_home.html", async (req, res) => {
  try {
    const drivers = await Driver.find();
    const buses = await Bus.find();
    res.render("admin_home", { drivers, buses });
  } catch (err) {
    console.error("Error fetching drivers or buses:", err);
    res.status(500).send("Server error");
  }
});

// Assign driver to bus (admin functionality)
app.post("/assign-driver-to-bus", async (req, res) => {
  const { driverId, busId } = req.body;
  try {
    const driver = await Driver.findById(driverId);
    const bus = await Bus.findById(busId);
    if (!driver) return res.send("Driver not found.");
    if (!bus) return res.send("Bus not found.");
    
    const mapping = new BusDriverMapping({ driverId, busId });
    await mapping.save();
    res.send(`Driver ${driver.driverId} has been assigned to bus ${bus.busNo}. <a href='/admin_home.html'>Go back</a>`);
  } catch (err) {
    console.error("Error assigning driver to bus:", err);
    res.status(500).send("Server error");
  }
});

// Save driver GPS location
app.post("/save-location", async (req, res) => {
  const { latitude, longitude, busNo, serviceNo, driverId } = req.body;

  try {
    if (!latitude || !longitude || !driverId || (!busNo && !serviceNo)) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const bus = await Bus.findOne({ $or: [{ busNo }, { serviceNo }] });

    if (!bus) {
      return res.status(400).json({ message: "Bus not found" });
    }

    let location = await LocationDriver.findOne({ busId: bus._id });

    if (!location) {
      location = new LocationDriver({
        busId: bus._id,
        busNo,
        serviceNo,
        driverId, // ✅ Set it here
        latitude,
        longitude,
        timestamp: new Date()
      });
    } else {
      location.latitude = latitude;
      location.longitude = longitude;
      location.timestamp = new Date();
    }

    await location.save();

    res.json({ message: "Location saved successfully!" });

  } catch (err) {
    console.error("Error saving location:", err);
    res.status(500).send("Server error");
  }
});





// Driver login and show their assigned bus and routes
app.post("/driver-login", async (req, res) => {
  const { driverId, password } = req.body;
  try {
    // Find the driver by driverId and password
    const driver = await Driver.findOne({ driverId, password });

    if (driver) {
      // Find the mapping of the driver to a bus
      const mapping = await BusDriverMapping.findOne({ driverId: driver._id }).populate("busId");

      if (mapping) {
        const bus = mapping.busId;
        req.session.driverId = driver._id; // Store driver session

        // Pass the driverId along with other data to the driver-home view
        res.render("driver-home", { 
          driver, 
          bus, 
          routes: bus.routes, 
          driverId: driver._id // Pass the driverId to the view
        });
      } else {
        res.send("No bus assigned to this driver.");
      }
    } else {
      res.send("Invalid driver credentials. <a href='/driver-login'>Try again</a>");
    }
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Server error");
  }
});


// Serve driver login page
app.get("/driver-login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "driverLogin.html"));
});

const LocationDriver = require('./models/locationDriver');  // Import the LocationDriver model


const port = 3000;

// Body parser middleware
app.use(bodyParser.json()); // For parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// Define the save-location route


// Other routes...
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});






app.get("/driver-home", async (req, res) => {
  const driverId = req.session.driverId;
  if (!driverId) {
    return res.redirect("/driver-login");
  }

  try {
    // Fetch driver
    const driver = await Driver.findById(driverId);
  
    // Fetch bus-driver mapping and populate bus details
    const mapping = await BusDriverMapping.findOne({ driverId: driver._id }).populate("busId");
    const bus = mapping ? mapping.busId : null;
  
    console.log("Mapping result:", mapping);
  
    // Render view
    res.render("driver-home", {
     
      driver,
      bus
    });
  
  } catch (err) {
    console.error("Error fetching driver or bus:", err);
    res.status(500).send("Something went wrong.");
  }
  

    // Fetch the most recent driver location from the locationDriver schema
    

    // Render the driver-home view and pass the data
  

});




app.get("/search-bus", async (req, res) => {
  const search = req.query.search;

  if (!search || search.trim() === "") {
    return res.render("search-results", {
      busesWithLocation: [],
      message: "Please enter a bus number or service number."
    });
  }

  try {
    // Step 1: Find matching buses
    const buses = await Bus.find({
      $or: [{ busNo: search }, { serviceNo: search }]
    });

    if (buses.length > 0) {
      const busesWithLocation = [];

      for (const bus of buses) {
        const latestLocation = await LocationDriver.findOne({ busId: bus._id })  // use bus._id
          .sort({ timestamp: -1 });

        busesWithLocation.push({
          bus,
          latitude: latestLocation ? latestLocation.latitude : null,
          longitude: latestLocation ? latestLocation.longitude : null,
        });
      }

      return res.render("search-results", {
        busesWithLocation,
        message: null
      });
    } else {
      return res.render("search-results", {
        busesWithLocation: [],
        message: "No bus found with that number."
      });
    }

  } catch (err) {
    console.error("Error searching for bus:", err);
    return res.status(500).render("search-results", {
      busesWithLocation: [],
      message: "Server error occurred while searching."
    });
  }
});







// Bus search by serviceNo or busNo


// Start server
app.listen(3000, () => console.log("Server running on http://localhost:3000"));
