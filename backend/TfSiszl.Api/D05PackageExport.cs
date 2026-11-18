using System.Globalization;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Xml;

internal static class D05PackageExport
{
    private static readonly Encoding Windows1251 = CreateWindows1251();

    public static byte[] CreateZip(D05Header header, IReadOnlyList<D05TaskData> tasks)
    {
        using var package = new MemoryStream();
        using (var archive = new ZipArchive(package, ZipArchiveMode.Create, leaveOpen: true))
        {
            var xmlEntry = archive.CreateEntry($"{header.Name}.xml", CompressionLevel.Fastest);
            using var xmlStream = xmlEntry.Open();
            WriteXml(xmlStream, header, tasks);
        }
        return package.ToArray();
    }

    private static void WriteXml(Stream stream, D05Header header, IReadOnlyList<D05TaskData> tasks)
    {
        var settings = new XmlWriterSettings
        {
            Encoding = Windows1251,
            Indent = true,
            OmitXmlDeclaration = false,
            CloseOutput = false
        };
        using var writer = XmlWriter.Create(stream, settings);
        writer.WriteStartDocument();
        writer.WriteStartElement("ZL_LIST");
        writer.WriteStartElement("ZGLV");
        Element(writer, "VERSION", "1.0");
        Element(writer, "CODE_MO", header.MoCode);
        Element(writer, "CODEM", header.MoCode);
        Element(writer, "DATE_F", Date(header.CreatedDate));
        Element(writer, "NAME_F", header.Name);
        Element(writer, "NAME_GF", header.SourceGfName);
        Element(writer, "YEAR", header.Year.ToString("D4", CultureInfo.InvariantCulture));
        Element(writer, "MONTH", header.Month.ToString(CultureInfo.InvariantCulture));
        Element(writer, "N_PACK", header.PackNumber);
        Element(writer, "DEADLINE", Date(header.Deadline));
        Element(writer, "SD_Z", header.TaskCount.ToString(CultureInfo.InvariantCulture));
        writer.WriteEndElement();

        foreach (var task in tasks)
        {
            writer.WriteStartElement("TASKS");
            Element(writer, "ZAP", task.Zap.ToString(CultureInfo.InvariantCulture));
            Element(writer, "TASK_ID", task.TaskId);
            Element(writer, "RESULT_CODE", "207");
            Element(writer, "REPEAT_CNT", "1");

            writer.WriteStartElement("PERSON");
            Element(writer, "ENP", task.Enp);
            OptionalElement(writer, "DN_PATIENT_ID", task.DnPatientId);
            Element(writer, "IDPAC", "0");
            Element(writer, "SURNAME", task.Surname);
            Element(writer, "NAME", task.Name);
            Element(writer, "PATRONYMIC", task.Patronymic);
            Element(writer, "BIRTHDAY", Date(task.Birthday));
            Element(writer, "SEX", task.Sex.ToString(CultureInfo.InvariantCulture));
            writer.WriteEndElement();

            writer.WriteStartElement("DN");
            Element(writer, "GROUP_RH_CD", task.GroupRhCode.ToString(CultureInfo.InvariantCulture));
            Element(writer, "GROUP_RH_NAME", task.GroupRhName);
            Element(writer, "GROUP_RH_DS", task.DiagnosisCode);
            OptionalElement(writer, "GROUP_RH_PROFILE", task.GroupRhProfile);
            if (task.DoctorType is not null)
                Element(writer, "DN_PRVS", task.DoctorType.Value.ToString(CultureInfo.InvariantCulture));
            writer.WriteEndElement();

            if (HasTrigger(task))
            {
                writer.WriteStartElement("TRIGGER");
                OptionalElement(writer, "TRIGGER_DT", Date(task.TriggerDate));
                OptionalElement(writer, "TRIGGER_DSCHET", Date(task.TriggerInvoiceDate));
                OptionalElement(writer, "TRIGGER_DS_CD", Limit(task.TriggerDiagnosisCode, 6));
                OptionalElement(writer, "TRIGGER_MCODE", Limit(task.TriggerMoCode, 6));
                OptionalElement(writer, "TRIGGER_SL_NHISTORY", Limit(task.TriggerHistoryNumber, 50));
                OptionalElement(writer, "TRIGGER_IDCASE", Limit(task.TriggerCaseId, 36));
                writer.WriteEndElement();
            }
            writer.WriteEndElement();
        }

        writer.WriteEndElement();
        writer.WriteEndDocument();
    }

    private static bool HasTrigger(D05TaskData task) =>
        task.TriggerDate is not null || task.TriggerInvoiceDate is not null ||
        !string.IsNullOrWhiteSpace(task.TriggerDiagnosisCode) || !string.IsNullOrWhiteSpace(task.TriggerMoCode) ||
        !string.IsNullOrWhiteSpace(task.TriggerHistoryNumber) || !string.IsNullOrWhiteSpace(task.TriggerCaseId);

    private static string Date(DateTime value) => value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    private static string? Date(DateTime? value) => value?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    private static string? Limit(string? value, int length) => string.IsNullOrWhiteSpace(value) ? null : value.Trim()[..Math.Min(value.Trim().Length, length)];

    private static void OptionalElement(XmlWriter writer, string name, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value)) Element(writer, name, value);
    }

    private static void Element(XmlWriter writer, string name, string value) => writer.WriteElementString(name, value);

    private static Encoding CreateWindows1251()
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        return Encoding.GetEncoding(1251, EncoderFallback.ExceptionFallback, DecoderFallback.ExceptionFallback);
    }
}

internal static class D05TestNames
{
    private static readonly string[] MaleSurnames = ["Иванов", "Петров", "Сидоров", "Смирнов", "Кузнецов", "Попов", "Васильев", "Соколов"];
    private static readonly string[] FemaleSurnames = ["Иванова", "Петрова", "Сидорова", "Смирнова", "Кузнецова", "Попова", "Васильева", "Соколова"];
    private static readonly string[] MaleNames = ["Александр", "Андрей", "Алексей", "Дмитрий", "Сергей", "Михаил", "Иван", "Николай"];
    private static readonly string[] FemaleNames = ["Анна", "Елена", "Мария", "Ольга", "Наталья", "Ирина", "Татьяна", "Светлана"];
    private static readonly string[] PatronymicRoots = ["Александр", "Андрей", "Алексей", "Дмитрий", "Сергей", "Михаил", "Иван", "Николай"];

    public static (string Surname, string Name, string Patronymic) For(string enp, int sex)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(enp));
        var index = hash[0] % MaleNames.Length;
        var surname = sex == 1 ? MaleSurnames[hash[1] % MaleSurnames.Length] : FemaleSurnames[hash[1] % FemaleSurnames.Length];
        var name = sex == 1 ? MaleNames[index] : FemaleNames[index];
        var root = PatronymicRoots[hash[2] % PatronymicRoots.Length];
        var patronymic = root + (sex == 1 ? "ович" : "овна");
        return (surname, name, patronymic);
    }
}
