using RecCenter.Core.Domain;
using RecCenter.Core.Models;
using RecCenter.Core.Supabase;

namespace RecCenter.Core.Services;

internal sealed record InventoryInsertPayload(string Name, int Quantity);

internal sealed record InventoryUpdatePayload(string Name, int Quantity, string UpdatedAt);

public sealed class InventoryService
{
    private readonly PostgrestClient _db;

    public InventoryService(PostgrestClient db) => _db = db;

    public Task<List<InventoryItem>> GetAllAsync() =>
        _db.GetAsync<InventoryItem>(PostgrestClient.From("inventory_items").Select("id, name, quantity, updated_at").Order("name"));

    public async Task<ActionResult> AddAsync(InventoryForm form)
    {
        var name = form.Name.Trim();
        var quantity = Formatting.ParseIntLoose(form.Quantity);
        if (name.Length == 0) return ActionResult.Fail("Item name is required.");
        if (quantity is null || quantity < 0) return ActionResult.Fail("Quantity must be a non-negative number.");

        try
        {
            await _db.InsertAsync("inventory_items", new InventoryInsertPayload(name, quantity.Value));
            return ActionResult.Ok;
        }
        catch (PostgrestException ex)
        {
            return ActionResult.Fail(ex.Code == "23505" ? "An item with this name already exists. Edit it instead." : ex.Message);
        }
    }

    public async Task<ActionResult> UpdateAsync(InventoryForm form)
    {
        var id = form.Id.Trim();
        var name = form.Name.Trim();
        var quantity = Formatting.ParseIntLoose(form.Quantity);
        if (id.Length == 0 || name.Length == 0) return ActionResult.Fail("Invalid item.");
        if (quantity is null || quantity < 0) return ActionResult.Fail("Quantity must be a non-negative number.");

        try
        {
            await _db.UpdateAsync(PostgrestClient.From("inventory_items").Eq("id", id),
                new InventoryUpdatePayload(name, quantity.Value, DateTime.UtcNow.ToString("o")));
            return ActionResult.Ok;
        }
        catch (PostgrestException ex)
        {
            return ActionResult.Fail(ex.Code == "23505" ? "An item with this name already exists." : ex.Message);
        }
    }

    public async Task<ActionResult> DeleteAsync(string id)
    {
        if (string.IsNullOrWhiteSpace(id)) return ActionResult.Fail("Invalid item.");
        try
        {
            await _db.DeleteAsync(PostgrestClient.From("inventory_items").Eq("id", id));
            return ActionResult.Ok;
        }
        catch (PostgrestException ex)
        {
            return ActionResult.Fail(ex.Message);
        }
    }
}
