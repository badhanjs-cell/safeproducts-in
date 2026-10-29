let pendingLabelCapture: File | null = null;

export function setPendingLabelCapture(file: File) {
  pendingLabelCapture = file;
}

export function takePendingLabelCapture(): File | null {
  const file = pendingLabelCapture;
  pendingLabelCapture = null;
  return file;
}
