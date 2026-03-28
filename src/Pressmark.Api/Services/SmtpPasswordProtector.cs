using Microsoft.AspNetCore.DataProtection;

namespace Pressmark.Api.Services;

public interface ISmtpPasswordProtector
{
    string Protect(string plaintext);

    // Returns the stored value as-is if unprotect fails — backward compat for
    // instances that were configured before encryption was added.
    string TryUnprotect(string value);
}

public class SmtpPasswordProtector(IDataProtectionProvider dp) : ISmtpPasswordProtector
{
    private readonly IDataProtector _protector = dp.CreateProtector("Pressmark.SmtpPassword");

    public string Protect(string plaintext) => _protector.Protect(plaintext);

    public string TryUnprotect(string value)
    {
        try
        {
            return _protector.Unprotect(value);
        }
        catch
        {
            return value;
        }
    }
}
