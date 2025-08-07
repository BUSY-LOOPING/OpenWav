import express  from "express";
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: "TODO" });
});

router.get('/:id', (req, res) => {
  const userId = req.params.id;
  res.json({ message: `TODO` });
});

export default router;