using Microsoft.AspNetCore.DataProtection;
using Pressmark.Api.Services;

namespace Pressmark.Api.Tests;

public class SmtpPasswordProtectorTests
{
    private static SmtpPasswordProtector Build()
    {
        // EphemeralDataProtectionProvider keeps keys in memory only — ideal for tests.
        var provider = new EphemeralDataProtectionProvider();
        return new SmtpPasswordProtector(provider);
    }

    [Fact]
    public void Protect_ThenTryUnprotect_RoundTrip()
    {
        var svc = Build();
        const string plain = "s3cr3t_smtp_p4ssword";

        var cipher = svc.Protect(plain);
        var result = svc.TryUnprotect(cipher);

        Assert.NotEqual(plain, cipher);     // ciphertext must differ from plaintext
        Assert.Equal(plain, result);        // unprotect must recover the original
    }

    [Fact]
    public void TryUnprotect_PlaintextFallback_ReturnsOriginalValue()
    {
        // Backward compat: values stored before encryption was added are returned as-is.
        var svc = Build();
        const string legacyPlaintext = "legacy_plain_password";

        var result = svc.TryUnprotect(legacyPlaintext);

        Assert.Equal(legacyPlaintext, result);
    }

    [Fact]
    public void Protect_SameInputDifferentInstances_ProducesDecryptableOutput()
    {
        // Both instances share the same ephemeral key provider so they can cross-decrypt.
        var provider = new EphemeralDataProtectionProvider();
        var svc1 = new SmtpPasswordProtector(provider);
        var svc2 = new SmtpPasswordProtector(provider);

        var cipher = svc1.Protect("shared_secret");
        Assert.Equal("shared_secret", svc2.TryUnprotect(cipher));
    }
}
