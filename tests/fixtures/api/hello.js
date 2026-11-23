export default function handler(req, res) {
  res.status(200).json({ message: 'hello', url: req.url });
}
