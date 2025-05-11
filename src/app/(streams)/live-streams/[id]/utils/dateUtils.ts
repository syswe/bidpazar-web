/**
 * Format a date string for display
 * @param dateString Date string to format
 * @returns Formatted date string
 */
export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "Belirtilmedi";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return "Geçersiz Tarih";
    }
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch (e) {
    console.error("Error formatting date", dateString, e);
    return "Hata";
  }
}; 