using RecCenter.Core.TeamCards;

namespace RecCenter.Core.TeamCards;

public interface IOcrService
{
    Task<IReadOnlyList<IReadOnlyList<OcrWord>>> RecognizePassesAsync(string imagePath);
}
