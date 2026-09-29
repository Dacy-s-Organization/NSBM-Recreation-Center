namespace RecCenter.Core.Domain;

public sealed record StudentColumn(string Key, string Label);

/// <summary>NSBM Foundation CSV columns + recreation house column.</summary>
public static class StudentColumns
{
    public static readonly IReadOnlyList<StudentColumn> All = new[]
    {
        new StudentColumn("serial_no", "Serial No"),
        new StudentColumn("intake", "Intake"),
        new StudentColumn("faculty", "Faculty"),
        new StudentColumn("student_id", "Student ID"),
        new StudentColumn("degree_programme", "Degree Programme"),
        new StudentColumn("university", "University"),
        new StudentColumn("title", "Title"),
        new StudentColumn("full_name", "Name with Initials"),
        new StudentColumn("gender", "Gender"),
        new StudentColumn("nic", "NIC/Passport"),
        new StudentColumn("mobile", "Mobile No"),
        new StudentColumn("email", "E-Mail"),
        new StudentColumn("house", "House"),
    };

    /// <summary>Columns that truncate with click-to-view when text is long.</summary>
    public static readonly HashSet<string> LongTextKeys = new() { "degree_programme" };

    /// <summary>Columns redundant when browsing a specific faculty + batch.</summary>
    public static readonly HashSet<string> ContextKeys = new() { "intake", "faculty" };
}
