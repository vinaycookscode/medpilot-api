import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
dotenv.config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'medpilot_user',
  password: process.env.DB_PASSWORD ?? 'medpilot_dev_2024',
  database: process.env.DB_NAME ?? 'medpilot_db',
  entities: [__dirname + '/../modules/**/*.entity{.ts,.js}'],
  synchronize: true,
  logging: false,
});

const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000).toISOString().split('T')[0];

async function seed() {
  await dataSource.initialize();
  console.log('Connected to database...');

  const clinicRepo      = dataSource.getRepository('clinics');
  const userRepo        = dataSource.getRepository('users');
  const medicineRepo    = dataSource.getRepository('medicines');
  const patientRepo     = dataSource.getRepository('patients');
  const rxRepo          = dataSource.getRepository('prescriptions');
  const rxMedRepo       = dataSource.getRepository('prescription_medicines');
  const rxTestRepo      = dataSource.getRepository('prescription_tests');
  const serviceRepo     = dataSource.getRepository('services');
  const invoiceRepo     = dataSource.getRepository('invoices');
  const invoiceItemRepo = dataSource.getRepository('invoice_items');
  const paymentRepo     = dataSource.getRepository('payments');

  // ── Clinic ──
  let clinic = await clinicRepo.findOne({ where: { slug: 'demo-clinic' } });
  if (!clinic) {
    clinic = await clinicRepo.save({
      name: 'MedPilot Demo Clinic',
      slug: 'demo-clinic',
      type: 'general',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      phone: '+91 22 1234 5678',
      email: 'info@democlinic.com',
      gstin: '27AABCU9603R1ZX',
      gstRegistered: true,
      timezone: 'Asia/Kolkata',
      currency: 'INR',
    });
    console.log('✅ Created demo clinic:', clinic.id);
  }

  const hash = await bcrypt.hash('Admin@123', 10);

  // ── Users ──
  const adminExists = await userRepo.findOne({ where: { email: 'admin@democlinic.com' } });
  if (!adminExists) {
    await userRepo.save({
      clinicId: clinic.id, email: 'admin@democlinic.com', passwordHash: hash,
      role: 'admin', firstName: 'Clinic', lastName: 'Admin',
      phone: '+91 98765 00001', isActive: true,
    });
    console.log('✅ Created admin user');
  }

  let doctor = await userRepo.findOne({ where: { email: 'doctor@democlinic.com' } });
  if (!doctor) {
    doctor = await userRepo.save({
      clinicId: clinic.id, email: 'doctor@democlinic.com', passwordHash: hash,
      role: 'doctor', firstName: 'Dr. Rajesh', lastName: 'Kumar',
      phone: '+91 98765 00002', specialization: 'General Physician',
      qualification: 'MBBS, MD', registrationNo: 'MH-12345',
      consultationFee: 500, isActive: true,
    });
    console.log('✅ Created doctor user');
  }

  const recepExists = await userRepo.findOne({ where: { email: 'reception@democlinic.com' } });
  if (!recepExists) {
    await userRepo.save({
      clinicId: clinic.id, email: 'reception@democlinic.com', passwordHash: hash,
      role: 'receptionist', firstName: 'Priya', lastName: 'Receptionist',
      phone: '+91 98765 00003', isActive: true,
    });
    console.log('✅ Created receptionist user');
  }

  // ── Medicines ──
  const medicineCount = await medicineRepo.count({ where: { clinicId: null } });
  if (medicineCount === 0) {
    const medicines = [
      { name: 'Amoxicillin 500mg',     genericName: 'Amoxicillin',     category: 'Antibiotic',      form: 'Capsule', strength: '500mg'       },
      { name: 'Paracetamol 500mg',     genericName: 'Paracetamol',     category: 'Analgesic',       form: 'Tablet',  strength: '500mg'       },
      { name: 'Ibuprofen 400mg',       genericName: 'Ibuprofen',       category: 'NSAID',           form: 'Tablet',  strength: '400mg'       },
      { name: 'Azithromycin 500mg',    genericName: 'Azithromycin',    category: 'Antibiotic',      form: 'Tablet',  strength: '500mg'       },
      { name: 'Cetirizine 10mg',       genericName: 'Cetirizine',      category: 'Antihistamine',   form: 'Tablet',  strength: '10mg'        },
      { name: 'Omeprazole 20mg',       genericName: 'Omeprazole',      category: 'PPI',             form: 'Capsule', strength: '20mg'        },
      { name: 'Metformin 500mg',       genericName: 'Metformin',       category: 'Antidiabetic',    form: 'Tablet',  strength: '500mg'       },
      { name: 'Atorvastatin 10mg',     genericName: 'Atorvastatin',    category: 'Statin',          form: 'Tablet',  strength: '10mg'        },
      { name: 'Amlodipine 5mg',        genericName: 'Amlodipine',      category: 'Antihypertensive',form: 'Tablet',  strength: '5mg'         },
      { name: 'Ciprofloxacin 500mg',   genericName: 'Ciprofloxacin',   category: 'Antibiotic',      form: 'Tablet',  strength: '500mg'       },
      { name: 'Doxycycline 100mg',     genericName: 'Doxycycline',     category: 'Antibiotic',      form: 'Capsule', strength: '100mg'       },
      { name: 'Metronidazole 400mg',   genericName: 'Metronidazole',   category: 'Antiprotozoal',   form: 'Tablet',  strength: '400mg'       },
      { name: 'Pantoprazole 40mg',     genericName: 'Pantoprazole',    category: 'PPI',             form: 'Tablet',  strength: '40mg'        },
      { name: 'Levothyroxine 50mcg',   genericName: 'Levothyroxine',   category: 'Thyroid',         form: 'Tablet',  strength: '50mcg'       },
      { name: 'Vitamin D3 60000 IU',   genericName: 'Cholecalciferol', category: 'Vitamin',         form: 'Capsule', strength: '60000 IU'    },
    ];
    for (const med of medicines) await medicineRepo.save({ ...med, isActive: true });
    console.log(`✅ Seeded ${medicines.length} medicines`);
  }

  // ── Patients ──
  const patientCount = await patientRepo.count({ where: { clinicId: clinic.id } });
  if (patientCount < 8) {
    const year = new Date().getFullYear();
    const patientData = [
      { firstName: 'Arjun',    lastName: 'Sharma',    phone: '9876501001', gender: 'male',   dateOfBirth: '1990-03-15', bloodGroup: 'B+', city: 'Mumbai',     addressLine1: '12 MG Road', chronicConditions: ['Hypertension'], allergies: ['Penicillin'] },
      { firstName: 'Priya',    lastName: 'Patel',     phone: '9876501002', gender: 'female', dateOfBirth: '1985-07-22', bloodGroup: 'A+', city: 'Mumbai',     addressLine1: '45 Linking Road' },
      { firstName: 'Ravi',     lastName: 'Mehta',     phone: '9876501003', gender: 'male',   dateOfBirth: '1978-11-08', bloodGroup: 'O+', city: 'Thane',      addressLine1: '8 Gokhale Nagar', chronicConditions: ['Diabetes Type 2'] },
      { firstName: 'Sunita',   lastName: 'Desai',     phone: '9876501004', gender: 'female', dateOfBirth: '1995-02-14', bloodGroup: 'AB+',city: 'Navi Mumbai', addressLine1: '23 Sector 7' },
      { firstName: 'Amit',     lastName: 'Joshi',     phone: '9876501005', gender: 'male',   dateOfBirth: '1988-09-30', bloodGroup: 'B-', city: 'Mumbai',     addressLine1: '67 SV Road', allergies: ['Sulfa drugs'] },
      { firstName: 'Kavitha',  lastName: 'Nair',      phone: '9876501006', gender: 'female', dateOfBirth: '1992-05-19', bloodGroup: 'O-', city: 'Mumbai',     addressLine1: '5 Hill Road' },
      { firstName: 'Deepak',   lastName: 'Verma',     phone: '9876501007', gender: 'male',   dateOfBirth: '1970-12-03', bloodGroup: 'A-', city: 'Borivali',   addressLine1: '90 LT Road', chronicConditions: ['Asthma', 'Hypertension'] },
      { firstName: 'Meena',    lastName: 'Singh',     phone: '9876501008', gender: 'female', dateOfBirth: '2000-08-25', bloodGroup: 'B+', city: 'Andheri',    addressLine1: '34 Carter Road' },
    ];

    const savedPatients: any[] = [];
    let seededCount = 0;
    for (let i = 0; i < patientData.length; i++) {
      const existing = await patientRepo.findOne({ where: { clinicId: clinic.id, phone: patientData[i].phone } });
      if (existing) { savedPatients.push(existing); continue; }
      const existingByCode = await patientRepo.count({ where: { clinicId: clinic.id } });
      const code = `P-${year}-${String(existingByCode + 1).padStart(5, '0')}`;
      const p = await patientRepo.save({
        ...patientData[i],
        patientCode: code,
        clinicId: clinic.id,
        allergies: (patientData[i] as any).allergies ?? [],
        chronicConditions: (patientData[i] as any).chronicConditions ?? [],
      });
      savedPatients.push(p);
      seededCount++;
    }
    console.log(`✅ Seeded ${seededCount} new patients (${savedPatients.length} total)`);

    // ── Prescriptions ──
    const rxCount = await rxRepo.count({ where: { clinicId: clinic.id } });
    const doctorUser = doctor ?? await userRepo.findOne({ where: { email: 'doctor@democlinic.com' } });
    if (!doctorUser) { console.log('⚠️  Doctor not found, skipping prescriptions'); }
    else if (rxCount > 0) { console.log(`ℹ️  Prescriptions already exist (${rxCount}), skipping`); }
    else {
      const rxData = [
        {
          patient: savedPatients[0],
          diagnosis: 'Upper Respiratory Tract Infection',
          chiefComplaint: 'Sore throat, cough for 3 days',
          examinationNotes: 'Throat hyperaemic, tonsils mildly enlarged. No cervical lymphadenopathy.',
          advice: 'Rest, warm fluids. Avoid cold beverages.',
          followUpDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          medicines: [
            { medicineName: 'Amoxicillin 500mg', dosage: '1 capsule', frequency: 'Three times daily', duration: '5 days', timing: 'After meals', sortOrder: 0 },
            { medicineName: 'Paracetamol 500mg', dosage: '1 tablet',  frequency: 'Twice daily (SOS)', duration: '3 days', timing: 'After meals', instructions: 'Only if fever above 38°C', sortOrder: 1 },
            { medicineName: 'Cetirizine 10mg',   dosage: '1 tablet',  frequency: 'Once daily at night', duration: '5 days', sortOrder: 2 },
          ],
          tests: [
            { testName: 'CBC with differential', instructions: 'Fasting not required', sortOrder: 0 },
            { testName: 'Throat swab culture', sortOrder: 1 },
          ],
        },
        {
          patient: savedPatients[1],
          diagnosis: 'Acute Gastritis',
          chiefComplaint: 'Epigastric pain, nausea since yesterday',
          examinationNotes: 'Epigastric tenderness present. No guarding or rigidity. Bowel sounds normal.',
          advice: 'Bland diet for 3 days. Avoid spicy, oily food. Small frequent meals.',
          medicines: [
            { medicineName: 'Pantoprazole 40mg',   dosage: '1 tablet', frequency: 'Once daily before breakfast', duration: '14 days', timing: 'Empty stomach', sortOrder: 0 },
            { medicineName: 'Metronidazole 400mg', dosage: '1 tablet', frequency: 'Twice daily',                 duration: '7 days',  timing: 'After meals', sortOrder: 1 },
          ],
          tests: [
            { testName: 'H. Pylori Antigen test (stool)', sortOrder: 0 },
          ],
        },
        {
          patient: savedPatients[2],
          diagnosis: 'Type 2 Diabetes Mellitus — Follow Up',
          chiefComplaint: 'Routine review, fasting sugar 210 mg/dL last week',
          examinationNotes: 'BP 138/88 mmHg. BMI 28. Pedal pulses normal. No neuropathy signs.',
          advice: 'Low glycaemic diet. Daily 30-min walk. Check feet daily.',
          followUpDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          followUpNotes: 'Review HbA1c results',
          medicines: [
            { medicineName: 'Metformin 500mg',    dosage: '1 tablet', frequency: 'Twice daily', duration: '30 days', timing: 'After meals', sortOrder: 0 },
            { medicineName: 'Atorvastatin 10mg',  dosage: '1 tablet', frequency: 'Once daily at night', duration: '30 days', sortOrder: 1 },
          ],
          tests: [
            { testName: 'HbA1c', instructions: 'Fasting', sortOrder: 0 },
            { testName: 'Fasting Blood Sugar', sortOrder: 1 },
            { testName: 'Lipid Profile', instructions: 'Fasting', sortOrder: 2 },
            { testName: 'Urine Microalbumin', sortOrder: 3 },
          ],
        },
        {
          patient: savedPatients[4],
          diagnosis: 'Allergic Rhinitis',
          chiefComplaint: 'Sneezing, runny nose, itchy eyes for 2 weeks',
          examinationNotes: 'Nasal mucosa pale and oedematous. Watery nasal discharge. Conjunctival injection bilateral.',
          advice: 'Avoid known allergens. Saline nasal irrigation twice daily.',
          medicines: [
            { medicineName: 'Cetirizine 10mg',   dosage: '1 tablet', frequency: 'Once daily at night', duration: '14 days', sortOrder: 0 },
            { medicineName: 'Ibuprofen 400mg',   dosage: '1 tablet', frequency: 'Twice daily (SOS)',   duration: '5 days',  timing: 'After meals', sortOrder: 1 },
          ],
          tests: [],
        },
        {
          patient: savedPatients[6],
          diagnosis: 'Bronchial Asthma — Acute Exacerbation',
          chiefComplaint: 'Shortness of breath, wheeze since morning',
          examinationNotes: 'RR 22/min. SpO2 96% on room air. Bilateral expiratory wheeze. No cyanosis.',
          advice: 'Use bronchodilator inhaler as prescribed. Avoid cold air and exercise until review.',
          followUpDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
          followUpNotes: 'Review if no improvement in 48 hours, consider oral steroids',
          medicines: [
            { medicineName: 'Azithromycin 500mg', dosage: '1 tablet', frequency: 'Once daily',  duration: '3 days',  timing: 'Before food', sortOrder: 0 },
            { medicineName: 'Ibuprofen 400mg',    dosage: '1 tablet', frequency: 'Twice daily', duration: '5 days',  timing: 'After meals', sortOrder: 1 },
          ],
          tests: [
            { testName: 'Peak Flow Rate', sortOrder: 0 },
            { testName: 'Chest X-Ray (PA view)', sortOrder: 1 },
          ],
        },
      ];

      for (const rxItem of rxData) {
        const { patient, medicines: meds, tests, ...rxFields } = rxItem;
        const rxId = uuidv4();
        const rx = await rxRepo.save({
          id: rxId,
          clinicId: clinic.id,
          patientId: patient.id,
          doctorId: doctorUser.id,
          ...rxFields,
        });

        for (let mi = 0; mi < meds.length; mi++) {
          await rxMedRepo.save({ ...meds[mi], id: uuidv4(), prescriptionId: rx.id });
        }
        for (let ti = 0; ti < tests.length; ti++) {
          await rxTestRepo.save({ ...tests[ti], id: uuidv4(), prescriptionId: rx.id });
        }
      }
      console.log(`✅ Seeded ${rxData.length} prescriptions`);
    }
  } else {
    console.log(`ℹ️  Patients already exist (${patientCount}), skipping patient + prescription seed`);
  }

  // ── Clinic Services ──
  const serviceCount = await serviceRepo.count({ where: { clinicId: clinic.id } });
  if (serviceCount === 0) {
    const services = [
      { name: 'General Consultation',    category: 'consultation', price: 500,  gstRate: 0,  gstApplicable: false, description: 'OPD general consultation' },
      { name: 'Follow-Up Consultation',  category: 'consultation', price: 300,  gstRate: 0,  gstApplicable: false, description: 'Follow-up visit within 7 days' },
      { name: 'Emergency Consultation',  category: 'consultation', price: 1000, gstRate: 0,  gstApplicable: false, description: 'Emergency / walk-in consultation' },
      { name: 'Blood Test — CBC',        category: 'lab',          price: 350,  gstRate: 5,  gstApplicable: true,  description: 'Complete Blood Count' },
      { name: 'Blood Test — LFT',        category: 'lab',          price: 600,  gstRate: 5,  gstApplicable: true,  description: 'Liver Function Test' },
      { name: 'Blood Test — KFT',        category: 'lab',          price: 600,  gstRate: 5,  gstApplicable: true,  description: 'Kidney Function Test' },
      { name: 'Blood Test — Lipid Profile', category: 'lab',       price: 700,  gstRate: 5,  gstApplicable: true,  description: 'Lipid Profile' },
      { name: 'Blood Test — HbA1c',      category: 'lab',          price: 500,  gstRate: 5,  gstApplicable: true,  description: 'Glycated Haemoglobin' },
      { name: 'Urine Routine',           category: 'lab',          price: 150,  gstRate: 5,  gstApplicable: true,  description: 'Urine routine & microscopy' },
      { name: 'ECG',                     category: 'procedure',    price: 400,  gstRate: 12, gstApplicable: true,  description: '12-lead ECG with report' },
      { name: 'Blood Pressure Check',    category: 'procedure',    price: 100,  gstRate: 0,  gstApplicable: false, description: 'BP measurement and recording' },
      { name: 'Dressing & Wound Care',   category: 'procedure',    price: 300,  gstRate: 12, gstApplicable: true,  description: 'Wound dressing / redressing' },
      { name: 'Nebulisation',            category: 'procedure',    price: 250,  gstRate: 12, gstApplicable: true,  description: 'Nebulisation therapy session' },
      { name: 'Injection (I/M)',         category: 'procedure',    price: 150,  gstRate: 12, gstApplicable: true,  description: 'Intramuscular injection administration' },
      { name: 'IV Fluid Administration', category: 'procedure',    price: 500,  gstRate: 12, gstApplicable: true,  description: 'Intravenous drip administration' },
    ];
    for (const svc of services) {
      await serviceRepo.save({ ...svc, defaultPrice: svc.price, id: uuidv4(), clinicId: clinic.id, isActive: true });
    }
    console.log(`✅ Seeded ${services.length} clinic services`);
  } else {
    console.log(`ℹ️  Services already exist (${serviceCount}), skipping`);
  }

  // ── Extra Prescriptions ──
  const totalRxCount = await rxRepo.count({ where: { clinicId: clinic.id } });
  if (totalRxCount < 12) {
    const allPatients = await patientRepo.find({ where: { clinicId: clinic.id } });
    const doctorUser2 = await userRepo.findOne({ where: { email: 'doctor@democlinic.com' } });

    const byName = (fn: string, ln: string) => allPatients.find(p => p.firstName === fn && p.lastName === ln);

    const extraRx = [
      {
        patient: byName('Priya', 'Patel'),
        diagnosis: 'Iron Deficiency Anaemia',
        chiefComplaint: 'Fatigue, pallor, weakness for 3 weeks',
        examinationNotes: 'Pallor +, Hb 8.6 g/dL. No organomegaly.',
        advice: 'Iron-rich diet (spinach, jaggery, dates). Avoid tea with meals.',
        followUpDate: daysFromNow(30),
        medicines: [
          { medicineName: 'Ferrous Sulphate 200mg', dosage: '1 tablet', frequency: 'Twice daily', duration: '90 days', timing: 'After meals', sortOrder: 0 },
          { medicineName: 'Folic Acid 5mg',         dosage: '1 tablet', frequency: 'Once daily',  duration: '90 days', timing: 'After meals', sortOrder: 1 },
          { medicineName: 'Vitamin C 500mg',        dosage: '1 tablet', frequency: 'Once daily',  duration: '30 days', timing: 'With iron tablet', sortOrder: 2 },
        ],
        tests: [
          { testName: 'CBC with Peripheral Smear', instructions: 'Fasting', sortOrder: 0 },
          { testName: 'Serum Ferritin',                                     sortOrder: 1 },
          { testName: 'Serum Iron & TIBC',                                  sortOrder: 2 },
        ],
      },
      {
        patient: byName('Sunita', 'Desai'),
        diagnosis: 'Urinary Tract Infection (UTI)',
        chiefComplaint: 'Burning micturition, frequency, mild fever since 2 days',
        examinationNotes: 'Suprapubic tenderness +. No loin pain. Temp 37.8°C.',
        advice: 'Drink minimum 3 litres water daily. Complete the antibiotic course.',
        medicines: [
          { medicineName: 'Nitrofurantoin 100mg', dosage: '1 capsule', frequency: 'Twice daily',  duration: '7 days',  timing: 'After meals', sortOrder: 0 },
          { medicineName: 'Paracetamol 650mg',    dosage: '1 tablet',  frequency: 'Three times daily (SOS)', duration: '3 days', timing: 'After meals', sortOrder: 1 },
          { medicineName: 'Cranberry Extract',    dosage: '1 capsule', frequency: 'Once daily',   duration: '30 days', sortOrder: 2 },
        ],
        tests: [
          { testName: 'Urine Routine & Microscopy', sortOrder: 0 },
          { testName: 'Urine Culture & Sensitivity', instructions: 'Midstream sample', sortOrder: 1 },
        ],
      },
      {
        patient: byName('Kavitha', 'Nair'),
        diagnosis: 'Migraine with Aura',
        chiefComplaint: 'Severe pulsating headache, left side, with visual disturbance, nausea',
        examinationNotes: 'Neurological exam — NAD. BP 120/78 mmHg. Fundus normal.',
        advice: 'Avoid known triggers (bright light, caffeine, irregular sleep). Maintain headache diary.',
        followUpDate: daysFromNow(45),
        medicines: [
          { medicineName: 'Sumatriptan 50mg',     dosage: '1 tablet', frequency: 'At onset, repeat after 2 hrs if needed', duration: 'SOS', timing: 'At first sign of migraine', sortOrder: 0 },
          { medicineName: 'Propranolol 40mg',     dosage: '1 tablet', frequency: 'Twice daily', duration: '60 days', timing: 'After meals', instructions: 'For prophylaxis — do not stop suddenly', sortOrder: 1 },
          { medicineName: 'Domperidone 10mg',     dosage: '1 tablet', frequency: 'Three times daily (SOS for nausea)', duration: '5 days', timing: 'Before meals', sortOrder: 2 },
        ],
        tests: [],
      },
      {
        patient: byName('Amit', 'Joshi'),
        diagnosis: 'Acute Pharyngitis',
        chiefComplaint: 'Sore throat, difficulty swallowing, mild fever for 2 days',
        examinationNotes: 'Throat congested, tonsillar exudate present. Temp 38.1°C. Cervical LN tender.',
        medicines: [
          { medicineName: 'Amoxicillin-Clavulanate 625mg', dosage: '1 tablet', frequency: 'Twice daily', duration: '7 days',  timing: 'After meals', sortOrder: 0 },
          { medicineName: 'Paracetamol 500mg',              dosage: '1 tablet', frequency: 'Three times daily', duration: '3 days', timing: 'After meals', sortOrder: 1 },
          { medicineName: 'Benzydamine Gargle',             dosage: '15 ml',    frequency: 'Four times daily', duration: '5 days', timing: 'After meals, do not swallow', sortOrder: 2 },
        ],
        tests: [
          { testName: 'Throat Swab C&S', sortOrder: 0 },
          { testName: 'CBC',             sortOrder: 1 },
        ],
      },
      {
        patient: byName('Arjun', 'Sharma'),
        diagnosis: 'Hypertension — Follow Up',
        chiefComplaint: 'Routine BP check. No symptoms. BP 148/92 at home.',
        examinationNotes: 'BP: 150/94 mmHg. Heart rate 78/min, regular. No oedema.',
        advice: 'Low salt diet (<5g/day). Regular 30-min walk. Monitor BP twice daily.',
        followUpDate: daysFromNow(30),
        medicines: [
          { medicineName: 'Amlodipine 5mg',     dosage: '1 tablet', frequency: 'Once daily morning', duration: '30 days', timing: 'After breakfast', sortOrder: 0 },
          { medicineName: 'Telmisartan 40mg',   dosage: '1 tablet', frequency: 'Once daily morning', duration: '30 days', timing: 'After breakfast', sortOrder: 1 },
          { medicineName: 'Aspirin 75mg',       dosage: '1 tablet', frequency: 'Once daily',         duration: '30 days', timing: 'After meals', sortOrder: 2 },
        ],
        tests: [
          { testName: 'ECG (12-lead)',   sortOrder: 0 },
          { testName: 'Urine Routine',  sortOrder: 1 },
          { testName: 'Serum Creatinine', sortOrder: 2 },
        ],
      },
      {
        patient: byName('Ravi', 'Mehta'),
        diagnosis: 'Diabetic Peripheral Neuropathy',
        chiefComplaint: 'Tingling, numbness in both feet. Poor sleep. Known diabetic.',
        examinationNotes: 'Monofilament test — reduced sensation bilateral soles. DTRs diminished. BP 136/86.',
        advice: 'Foot care hygiene. Check feet daily. Strict glycaemic control. Stop smoking.',
        followUpDate: daysFromNow(60),
        medicines: [
          { medicineName: 'Pregabalin 75mg',      dosage: '1 capsule', frequency: 'Twice daily',       duration: '90 days', timing: 'After meals', sortOrder: 0 },
          { medicineName: 'Methylcobalamin 1500mcg', dosage: '1 tablet', frequency: 'Once daily',      duration: '60 days', timing: 'After meals', sortOrder: 1 },
          { medicineName: 'Metformin 500mg',      dosage: '1 tablet',  frequency: 'Twice daily',       duration: '30 days', timing: 'After meals', sortOrder: 2 },
          { medicineName: 'Alpha Lipoic Acid 600mg', dosage: '1 tablet', frequency: 'Once daily',     duration: '90 days', timing: 'Before meals', sortOrder: 3 },
        ],
        tests: [
          { testName: 'HbA1c',                     sortOrder: 0 },
          { testName: 'Fasting & PP Blood Sugar',  sortOrder: 1 },
          { testName: 'Nerve Conduction Study',    instructions: 'Both lower limbs', sortOrder: 2 },
        ],
      },
      {
        patient: byName('Deepak', 'Verma'),
        diagnosis: 'Acute Exacerbation of COPD',
        chiefComplaint: 'Increased breathlessness, productive cough, yellow sputum × 3 days',
        examinationNotes: 'RR 24/min, SpO2 93%. Bilateral coarse crepts. Using accessory muscles.',
        advice: 'Complete antibiotic course. Quit smoking immediately. Use inhaler as directed.',
        followUpDate: daysFromNow(7),
        medicines: [
          { medicineName: 'Levosalbutamol + Ipratropium Inhaler', dosage: '2 puffs', frequency: 'Four times daily', duration: '10 days', timing: 'Spacer preferred', sortOrder: 0 },
          { medicineName: 'Prednisolone 30mg',   dosage: '1 tablet',  frequency: 'Once daily morning', duration: '5 days', timing: 'After breakfast', instructions: 'Taper as directed', sortOrder: 1 },
          { medicineName: 'Azithromycin 500mg',  dosage: '1 tablet',  frequency: 'Once daily',         duration: '5 days', timing: 'Before food', sortOrder: 2 },
          { medicineName: 'Mucosolvan 30mg',     dosage: '1 tablet',  frequency: 'Three times daily',  duration: '7 days', timing: 'After meals', sortOrder: 3 },
        ],
        tests: [
          { testName: 'Chest X-Ray (PA view)',   sortOrder: 0 },
          { testName: 'Sputum C&S',              sortOrder: 1 },
          { testName: 'ABG (Arterial Blood Gas)', instructions: 'Repeat if SpO2 drops below 90%', sortOrder: 2 },
        ],
      },
      {
        patient: byName('Meena', 'Singh'),
        diagnosis: 'Polycystic Ovary Syndrome (PCOS)',
        chiefComplaint: 'Irregular periods, weight gain, acne, mild hirsutism',
        examinationNotes: 'BMI 28. Mild hirsutism. Acne on face. USG: polycystic ovaries bilateral.',
        advice: 'Weight loss through diet & exercise is key. Low glycaemic diet. Regular menstrual tracking.',
        followUpDate: daysFromNow(90),
        medicines: [
          { medicineName: 'Metformin 500mg',          dosage: '1 tablet',  frequency: 'Twice daily', duration: '90 days', timing: 'After meals', sortOrder: 0 },
          { medicineName: 'Spironolactone 25mg',      dosage: '1 tablet',  frequency: 'Once daily',  duration: '90 days', timing: 'After meals', instructions: 'For hirsutism/acne', sortOrder: 1 },
          { medicineName: 'Inositol 2g + Folic Acid', dosage: '1 sachet',  frequency: 'Once daily',  duration: '90 days', timing: 'With water before breakfast', sortOrder: 2 },
        ],
        tests: [
          { testName: 'Fasting Insulin + Glucose',    sortOrder: 0 },
          { testName: 'LH : FSH Ratio (Day 2-3)',     sortOrder: 1 },
          { testName: 'Free Testosterone',            sortOrder: 2 },
          { testName: 'Thyroid Profile (TSH, FT3, FT4)', sortOrder: 3 },
        ],
      },
    ].filter(rx => rx.patient !== undefined);

    for (const rxItem of extraRx) {
      const { patient, medicines: meds, tests, ...rxFields } = rxItem as any;
      const rxId = uuidv4();
      const rx = await rxRepo.save({ id: rxId, clinicId: clinic.id, patientId: patient.id, doctorId: doctorUser2!.id, ...rxFields });
      for (let mi = 0; mi < meds.length; mi++) {
        await rxMedRepo.save({ ...meds[mi], id: uuidv4(), prescriptionId: rx.id });
      }
      for (let ti = 0; ti < tests.length; ti++) {
        await rxTestRepo.save({ ...tests[ti], id: uuidv4(), prescriptionId: rx.id });
      }
    }
    console.log(`✅ Seeded ${extraRx.length} additional prescriptions`);
  } else {
    console.log(`ℹ️  Enough prescriptions exist (${totalRxCount}), skipping extra Rx seed`);
  }

  // ── Invoices ──
  const invoiceCount = await invoiceRepo.count({ where: { clinicId: clinic.id } });
  if (invoiceCount < 10) {
    const allPatients2 = await patientRepo.find({ where: { clinicId: clinic.id } });
    const adminUser   = await userRepo.findOne({ where: { email: 'admin@democlinic.com' } });
    await serviceRepo.find({ where: { clinicId: clinic.id } });

    const byName2 = (fn: string, ln: string) => allPatients2.find(p => p.firstName === fn && p.lastName === ln)!;

    function makeInvoice(
      patient: any, num: string, daysAgo: number,
      items: { desc: string; qty: number; price: number; gstRate?: number }[],
      status: string, paidAmt: number, payMethod?: string,
    ) {
      const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
      const cgst = items.reduce((s, i) => s + (i.qty * i.price * (i.gstRate ?? 0) / 100) / 2, 0);
      const sgst = cgst;
      const total = subtotal + cgst + sgst;
      const date  = new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0];
      return { patient, num, date, items, status, paidAmt, payMethod, subtotal, cgst, sgst, total };
    }

    const invoiceDefs = [
      makeInvoice(byName2('Arjun','Sharma'),  'INV-2026-00002', 60,
        [{ desc: 'General Consultation', qty:1, price:500 }, { desc: 'Blood Pressure Check', qty:1, price:100 }, { desc: 'Blood Test — CBC', qty:1, price:350, gstRate:5 }],
        'paid', 967.5, 'upi'),

      makeInvoice(byName2('Priya','Patel'),   'INV-2026-00003', 55,
        [{ desc: 'General Consultation', qty:1, price:500 }, { desc: 'Urine Routine', qty:1, price:150, gstRate:5 }],
        'paid', 657.5, 'cash'),

      makeInvoice(byName2('Ravi','Mehta'),    'INV-2026-00004', 45,
        [{ desc: 'General Consultation', qty:1, price:500 }, { desc: 'Blood Test — HbA1c', qty:1, price:500, gstRate:5 }, { desc: 'Blood Test — Lipid Profile', qty:1, price:700, gstRate:5 }, { desc: 'ECG', qty:1, price:400, gstRate:12 }],
        'paid', 2198, 'card'),

      makeInvoice(byName2('Sunita','Desai'),  'INV-2026-00005', 40,
        [{ desc: 'General Consultation', qty:1, price:500 }, { desc: 'Urine Routine', qty:1, price:150, gstRate:5 }, { desc: 'Blood Test — CBC', qty:1, price:350, gstRate:5 }],
        'partially_paid', 500, 'cash'),

      makeInvoice(byName2('Amit','Joshi'),    'INV-2026-00006', 35,
        [{ desc: 'General Consultation', qty:1, price:500 }, { desc: 'Injection (I/M)', qty:2, price:150, gstRate:12 }],
        'paid', 836, 'upi'),

      makeInvoice(byName2('Kavitha','Nair'),  'INV-2026-00007', 30,
        [{ desc: 'General Consultation', qty:1, price:500 }],
        'paid', 500, 'cash'),

      makeInvoice(byName2('Deepak','Verma'),  'INV-2026-00008', 25,
        [{ desc: 'Emergency Consultation', qty:1, price:1000 }, { desc: 'Nebulisation', qty:2, price:250, gstRate:12 }, { desc: 'ECG', qty:1, price:400, gstRate:12 }, { desc: 'Injection (I/M)', qty:1, price:150, gstRate:12 }],
        'partially_paid', 1000, 'cash'),

      makeInvoice(byName2('Meena','Singh'),   'INV-2026-00009', 20,
        [{ desc: 'General Consultation', qty:1, price:500 }, { desc: 'Blood Test — CBC', qty:1, price:350, gstRate:5 }],
        'sent', 0),

      makeInvoice(byName2('Arjun','Sharma'),  'INV-2026-00010', 15,
        [{ desc: 'Follow-Up Consultation', qty:1, price:300 }, { desc: 'Blood Pressure Check', qty:1, price:100 }],
        'paid', 400, 'upi'),

      makeInvoice(byName2('Priya','Patel'),   'INV-2026-00011', 12,
        [{ desc: 'Follow-Up Consultation', qty:1, price:300 }, { desc: 'Blood Test — CBC', qty:1, price:350, gstRate:5 }, { desc: 'Serum Ferritin', qty:1, price:400, gstRate:5 }],
        'overdue', 0),

      makeInvoice(byName2('Ravi','Mehta'),    'INV-2026-00012', 7,
        [{ desc: 'Follow-Up Consultation', qty:1, price:300 }],
        'paid', 300, 'upi'),

      makeInvoice(byName2('Kavitha','Nair'),  'INV-2026-00013', 3,
        [{ desc: 'General Consultation', qty:1, price:500 }, { desc: 'Urine Routine', qty:1, price:150, gstRate:5 }, { desc: 'Blood Test — KFT', qty:1, price:600, gstRate:5 }],
        'draft', 0),
    ];

    let invoiceSeededCount = 0;
    for (const def of invoiceDefs) {
      const existing = await invoiceRepo.findOne({ where: { invoiceNumber: def.num } });
      if (existing) continue;

      const inv = await invoiceRepo.save({
        id: uuidv4(),
        clinicId: clinic.id,
        patientId: def.patient.id,
        invoiceNumber: def.num,
        invoiceDate: def.date,
        status: def.status,
        subtotal: def.subtotal,
        cgstAmount: def.cgst,
        sgstAmount: def.sgst,
        igstAmount: 0,
        totalAmount: def.total,
        paidAmount: def.paidAmt,
        discountAmount: 0,
        discountPercent: 0,
        paymentStatus: def.paidAmt >= def.total ? 'paid' : def.paidAmt > 0 ? 'partial' : 'pending',
        createdBy: adminUser?.id ?? null,
      });

      for (let si = 0; si < def.items.length; si++) {
        const it = def.items[si];
        const gstAmt = it.qty * it.price * ((it.gstRate ?? 0) / 100);
        await invoiceItemRepo.save({
          id: uuidv4(),
          invoiceId: inv.id,
          description: it.desc,
          quantity: it.qty,
          unitPrice: it.price,
          discountAmount: 0,
          gstRate: it.gstRate ?? 0,
          gstAmount: gstAmt,
          totalAmount: it.qty * it.price + gstAmt,
          sortOrder: si,
        });
      }

      if (def.paidAmt > 0 && def.payMethod) {
        await paymentRepo.save({
          id: uuidv4(),
          clinicId: clinic.id,
          invoiceId: inv.id,
          patientId: def.patient.id,
          amount: def.paidAmt,
          paymentMethod: def.payMethod,
          paymentDate: def.date,
        });
      }
      invoiceSeededCount++;
    }
    console.log(`✅ Seeded ${invoiceSeededCount} invoices`);
  } else {
    console.log(`ℹ️  Enough invoices exist (${invoiceCount}), skipping`);
  }

  console.log('\n🚀 Seed complete!');
  console.log('======================');
  console.log('Login credentials:');
  console.log('  Admin:        admin@democlinic.com / Admin@123');
  console.log('  Doctor:       doctor@democlinic.com / Admin@123');
  console.log('  Receptionist: reception@democlinic.com / Admin@123');
  console.log('======================');

  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
