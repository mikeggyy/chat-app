export async function listStoreItems(req, res, next) {
  try {
    res.json({
      data: [
        { id: 'aurora-premium', name: 'Aurora Premium Pack', price: 999 },
      ],
    });
  } catch (error) {
    next(error);
  }
}

export async function purchaseItem(req, res, next) {
  try {
    const { itemId } = req.body;

    if (!itemId) {
      return res.status(400).json({ message: 'itemId is required' });
    }

    // TODO: integrate with payment provider + Firebase
    res.status(202).json({ message: 'Purchase processing' });
  } catch (error) {
    next(error);
  }
}
